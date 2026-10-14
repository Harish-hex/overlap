<?php
function db(): PDO {
    static $pdo;
    if (!$pdo) {
        $c = require __DIR__ . '/config.php';
        $pdo = new PDO($c['dsn'], $c['user'], $c['pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
    return $pdo;
}

function out($data, int $code = 200): never {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function fail(string $msg, int $code = 400): never { out(['error' => $msg], $code); }

function body(): array {
    $d = json_decode(file_get_contents('php://input') ?: '', true);
    return is_array($d) ? $d : [];
}

function token(): string { return bin2hex(random_bytes(16)); }

function hhmm(string $t): string { return substr($t, 0, 5); }

function minutes(string $hhmm): int {
    [$h, $m] = array_map('intval', explode(':', $hhmm));
    return $h * 60 + $m;
}

function find_event(string $slug): array {
    $st = db()->prepare('SELECT * FROM events WHERE slug = ?');
    $st->execute([$slug]);
    return $st->fetch() ?: fail('Event not found', 404);
}

/** Grid geometry. slot_index = dayIdx * perDay + slotInDay. */
function grid(array $e): array {
    $days = (int) ((strtotime($e['end_date']) - strtotime($e['start_date'])) / 86400) + 1;
    $perDay = intdiv(minutes($e['day_end']) - minutes($e['day_start']), (int) $e['slot_minutes']);
    return ['days' => $days, 'perDay' => $perDay, 'total' => $days * $perDay,
            'k' => intdiv((int) $e['meeting_length'], (int) $e['slot_minutes'])];
}

function event_public(array $e): array {
    $g = grid($e);
    return [
        'slug' => $e['slug'], 'title' => $e['title'],
        'start_date' => $e['start_date'], 'end_date' => $e['end_date'],
        'day_start' => hhmm($e['day_start']), 'day_end' => hhmm($e['day_end']),
        'slot_minutes' => (int) $e['slot_minutes'], 'meeting_length' => (int) $e['meeting_length'],
        'timezone' => $e['timezone'],
        'final_slot' => $e['final_slot'] === null ? null : (int) $e['final_slot'],
        'grid' => $g,
    ];
}

function check_admin(array $e, ?string $tok): bool {
    return $tok && hash_equals($e['admin_token'], $tok);
}

/** @return array<int, array{id:int,name:string,slots:int[]}> */
function load_people(array $e): array {
    $st = db()->prepare('SELECT id, name FROM participants WHERE event_id = ? ORDER BY id');
    $st->execute([$e['id']]);
    $people = [];
    foreach ($st->fetchAll() as $p) $people[(int) $p['id']] = ['id' => (int) $p['id'], 'name' => $p['name'], 'slots' => []];
    if ($people) {
        $in = implode(',', array_keys($people));
        foreach (db()->query("SELECT participant_id, slot_index FROM availability WHERE participant_id IN ($in)") as $r)
            $people[(int) $r['participant_id']]['slots'][] = (int) $r['slot_index'];
    }
    return $people;
}

/**
 * Best-slot algorithm: slide a window of k slots across each day, score by
 * the number of people free in every slot of the window. Ties: earlier slot.
 */
function suggest(array $e, array $people): array {
    $g = grid($e);
    $free = [];
    foreach ($people as $p) foreach ($p['slots'] as $s) $free[$s][$p['id']] = true;
    $cands = [];
    for ($day = 0; $day < $g['days']; $day++) {
        for ($i = 0; $i + $g['k'] <= $g['perDay']; $i++) {
            $start = $day * $g['perDay'] + $i;
            $ids = array_keys($people);
            for ($j = 0; $j < $g['k'] && $ids; $j++) $ids = array_filter($ids, fn($id) => isset($free[$start + $j][$id]));
            $cands[] = ['slot' => $start, 'free' => array_values($ids)];
        }
    }
    usort($cands, fn($a, $b) => [count($b['free']), $a['slot']] <=> [count($a['free']), $b['slot']]);
    $res = [];
    foreach (array_slice($cands, 0, 3) as $c) {
        if (!$people) break;
        $res[] = [
            'slot' => $c['slot'],
            'free' => array_map(fn($id) => $people[$id]['name'], $c['free']),
            'missing' => array_values(array_map(fn($p) => $p['name'],
                array_filter($people, fn($p) => !in_array($p['id'], $c['free'], true)))),
        ];
    }
    return $res;
}

function slot_to_datetime(array $e, int $slot): DateTimeImmutable {
    $g = grid($e);
    $day = intdiv($slot, $g['perDay']);
    $min = minutes($e['day_start']) + ($slot % $g['perDay']) * (int) $e['slot_minutes'];
    return (new DateTimeImmutable($e['start_date'] . ' 00:00', new DateTimeZone($e['timezone'])))
        ->modify("+$day days")->modify("+$min minutes");
}
