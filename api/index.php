<?php
require __DIR__ . '/lib.php';

set_exception_handler(fn($ex) => fail('Server error: ' . $ex->getMessage(), 500));

$method = $_SERVER['REQUEST_METHOD'];
$path = '/' . trim(preg_replace('#^/api#', '', parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH)), '/');
$m = [];

if ($method === 'POST' && $path === '/events') {
    $b = body();
    $title = trim((string) ($b['title'] ?? ''));
    $tz = (string) ($b['timezone'] ?? 'UTC');
    $ds = (string) ($b['start_date'] ?? ''); $de = (string) ($b['end_date'] ?? '');
    $ts = (string) ($b['day_start'] ?? ''); $te = (string) ($b['day_end'] ?? '');
    $slot = (int) ($b['slot_minutes'] ?? 30); $len = (int) ($b['meeting_length'] ?? 60);
    if ($title === '' || mb_strlen($title) > 120) fail('Title is required (max 120 chars)');
    try { new DateTimeZone($tz); } catch (Exception $x) { fail('Unknown timezone'); }
    if (!str_contains($tz, '/') && $tz !== 'UTC') fail('Unknown timezone');
    foreach ([$ds, $de] as $d) if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) || !strtotime($d)) fail('Invalid date');
    foreach ([$ts, $te] as $t) if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $t)) fail('Invalid time');
    if ($de < $ds) fail('End date is before start date');
    if ((strtotime($de) - strtotime($ds)) / 86400 > 30) fail('Date range is limited to 31 days');
    if (!in_array($slot, [15, 30, 60], true)) fail('Slot size must be 15, 30 or 60 minutes');
    if ($ts === $te) fail('Daily window start and end must differ');
    $win = window_minutes($ts, $te); // end before start = overnight window
    if ($win % $slot) fail('Daily window must be a multiple of the slot size');
    if ($len < $slot || $len % $slot) fail('Meeting length must be a multiple of the slot size');
    if ($len > $win) fail('Meeting is longer than the daily window');
    $admin = token();
    for ($try = 0; ; $try++) {
        $slug = substr(bin2hex(random_bytes(5)), 0, 8);
        try {
            db()->prepare('INSERT INTO events (slug,title,start_date,end_date,day_start,day_end,slot_minutes,meeting_length,timezone,admin_token) VALUES (?,?,?,?,?,?,?,?,?,?)')
                ->execute([$slug, $title, $ds, $de, $ts, $te, $slot, $len, $tz, $admin]);
            break;
        } catch (PDOException $ex) { if ($try > 3 || $ex->getCode() != 23000) throw $ex; }
    }
    out(['slug' => $slug, 'share_path' => "/e/$slug", 'admin_path' => "/app/#/admin/$slug/$admin", 'admin_token' => $admin], 201);
}

if ($method === 'GET' && preg_match('#^/events/(\w+)$#', $path, $m)) {
    $e = find_event($m[1]);
    $r = event_public($e);
    $r['is_admin'] = check_admin($e, $_GET['admin'] ?? null);
    out($r);
}

if ($method === 'POST' && preg_match('#^/events/(\w+)/join$#', $path, $m)) {
    $e = find_event($m[1]);
    $name = trim((string) (body()['name'] ?? ''));
    if ($name === '' || mb_strlen($name) > 60) fail('Name is required (max 60 chars)');
    $tok = token();
    db()->prepare('INSERT INTO participants (event_id,name,edit_token) VALUES (?,?,?)')->execute([$e['id'], $name, $tok]);
    out(['participant_id' => (int) db()->lastInsertId(), 'edit_token' => $tok], 201);
}

if (preg_match('#^/participants/(\d+)/slots$#', $path, $m)) {
    $st = db()->prepare('SELECT p.*, e.slug FROM participants p JOIN events e ON e.id = p.event_id WHERE p.id = ?');
    $st->execute([$m[1]]);
    $p = $st->fetch() ?: fail('Participant not found', 404);
    $tok = $method === 'GET' ? ($_GET['token'] ?? '') : (string) (body()['token'] ?? '');
    if (!hash_equals($p['edit_token'], (string) $tok)) fail('Invalid edit token', 403);
    $e = find_event($p['slug']);
    if ($method === 'GET') {
        $s = db()->prepare('SELECT slot_index FROM availability WHERE participant_id = ? ORDER BY slot_index');
        $s->execute([$p['id']]);
        out(['name' => $p['name'], 'slots' => array_map('intval', array_column($s->fetchAll(), 'slot_index'))]);
    }
    if ($method === 'PUT') {
        if ($e['final_slot'] !== null) fail('This event is locked', 409);
        $slots = body()['slots'] ?? null;
        if (!is_array($slots)) fail('slots must be an array');
        $total = grid($e)['total'];
        $slots = array_values(array_unique(array_map('intval', $slots)));
        foreach ($slots as $s) if ($s < 0 || $s >= $total) fail('Slot out of range');
        $pdo = db();
        $pdo->beginTransaction();
        $pdo->prepare('DELETE FROM availability WHERE participant_id = ?')->execute([$p['id']]);
        $ins = $pdo->prepare('INSERT INTO availability (participant_id, slot_index) VALUES (?, ?)');
        foreach ($slots as $s) $ins->execute([$p['id'], $s]);
        $pdo->commit();
        out(['saved' => count($slots)]);
    }
}

if ($method === 'GET' && preg_match('#^/events/(\w+)/heatmap$#', $path, $m)) {
    $e = find_event($m[1]);
    $people = load_people($e);
    $slots = [];
    foreach ($people as $p) foreach ($p['slots'] as $s) $slots[$s][] = $p['name'];
    out(['participants' => array_column($people, 'name'), 'slots' => (object) $slots]);
}

if ($method === 'GET' && preg_match('#^/events/(\w+)/suggest$#', $path, $m)) {
    $e = find_event($m[1]);
    out(['suggestions' => suggest($e, load_people($e))]);
}

if ($method === 'POST' && preg_match('#^/events/(\w+)/finalize$#', $path, $m)) {
    $e = find_event($m[1]);
    $b = body();
    if (!check_admin($e, (string) ($b['admin_token'] ?? ''))) fail('Invalid admin token', 403);
    $g = grid($e);
    if (array_key_exists('slot', $b) && $b['slot'] === null) { // unlock
        db()->prepare('UPDATE events SET final_slot = NULL WHERE id = ?')->execute([$e['id']]);
        out(['final_slot' => null]);
    }
    $slot = (int) ($b['slot'] ?? -1);
    if ($slot < 0 || $slot + $g['k'] > $g['total'] || intdiv($slot, $g['perDay']) !== intdiv($slot + $g['k'] - 1, $g['perDay']))
        fail('Slot does not fit inside a single day');
    db()->prepare('UPDATE events SET final_slot = ? WHERE id = ?')->execute([$slot, $e['id']]);
    out(['final_slot' => $slot]);
}

if ($method === 'GET' && preg_match('#^/events/(\w+)/ics$#', $path, $m)) {
    $e = find_event($m[1]);
    if ($e['final_slot'] === null) fail('Event is not finalized yet', 404);
    $s = slot_to_datetime($e, (int) $e['final_slot'])->setTimezone(new DateTimeZone('UTC'));
    $en = $s->modify('+' . (int) $e['meeting_length'] . ' minutes');
    $f = fn($d) => $d->format('Ymd\THis\Z');
    $esc = fn($t) => addcslashes($t, ",;\\");
    header('Content-Type: text/calendar; charset=utf-8');
    header('Content-Disposition: attachment; filename="overlap-' . $e['slug'] . '.ics"');
    echo "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Overlap//EN\r\nBEGIN:VEVENT\r\n"
       . "UID:{$e['slug']}@overlap\r\nDTSTAMP:" . $f(new DateTimeImmutable('now', new DateTimeZone('UTC')))
       . "\r\nDTSTART:" . $f($s) . "\r\nDTEND:" . $f($en) . "\r\nSUMMARY:" . $esc($e['title']) . "\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
    exit;
}

fail('Not found', 404);
