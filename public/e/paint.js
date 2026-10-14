(function () {
  var slug = location.pathname.split('/').filter(Boolean)[1];
  var app = document.getElementById('app');
  var qs = new URLSearchParams(location.search);
  var store = {
    get: function () { try { return JSON.parse(localStorage.getItem('overlap:' + slug)); } catch (e) { return null; } },
    set: function (v) { try { localStorage.setItem('overlap:' + slug, JSON.stringify(v)); } catch (e) {} }
  };
  var ev, me, selected = new Set();

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }
  function api(path, opts) {
    return fetch('/api' + path, opts).then(function (r) {
      return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Request failed'); return d; });
    });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function mins(t) { var p = t.split(':'); return +p[0] * 60 + +p[1]; }
  function fmtTime(m) { return pad(Math.floor((m % 1440) / 60)) + ':' + pad(m % 60); }
  function dayDate(i) { return new Date(Date.parse(ev.start_date + 'T00:00:00Z') + i * 864e5); }
  function dayLabel(i, long) {
    return dayDate(i).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  function slotTime(s) {
    var g = ev.grid;
    return Math.floor(mins(ev.day_start) + (s % g.perDay) * ev.slot_minutes);
  }
  function rangeLabel(s) {
    var g = ev.grid, m = slotTime(s);
    return dayLabel(Math.floor(s / g.perDay) + Math.floor(m / 1440)) + ', ' + fmtTime(m) + '–' + fmtTime(m + ev.meeting_length) + ' (' + ev.timezone + ')';
  }

  function render(node) { app.textContent = ''; app.appendChild(node); }

  function showFinal() {
    var box = el('div', { 'class': 'final-box' }, [
      el('p', { 'class': 'muted', text: 'The time is locked' }),
      el('div', { 'class': 'big', text: rangeLabel(ev.final_slot) }),
      el('p', {}, [el('a', { 'class': 'btn', href: '/api/events/' + slug + '/ics', text: 'Add to calendar (.ics)' })])
    ]);
    render(el('div', {}, [el('h1', { text: ev.title }), box]));
  }

  function showJoin() {
    var input = el('input', { id: 'name', placeholder: 'Your name', maxlength: 60, autocomplete: 'given-name' });
    var err = el('div', { 'class': 'err', role: 'alert' });
    var go = el('button', { 'class': 'btn', text: 'Continue', onclick: function () {
      var name = input.value.trim();
      if (!name) { err.textContent = 'Please enter a name.'; return; }
      go.disabled = true;
      api('/events/' + slug + '/join', { method: 'POST', body: JSON.stringify({ name: name }) })
        .then(function (r) { me = { id: r.participant_id, token: r.edit_token, name: name }; store.set(me); showPaint(); })
        .catch(function (e) { err.textContent = e.message; go.disabled = false; });
    } });
    render(el('div', {}, [
      el('h1', { text: ev.title }),
      el('p', { text: 'Mark when you are free. Times are in ' + ev.timezone + '.' }),
      el('label', { 'for': 'name', text: 'Your name' }), input, err, go
    ]));
    input.focus();
  }

  function showPaint() {
    var g = ev.grid, cells = [], mode = null, painting = false, lastCell = null;
    var grid = el('div', { 'class': 'grid', role: 'group', 'aria-label': 'Availability grid' });
    grid.style.gridTemplateColumns = 'auto repeat(' + g.days + ', minmax(52px, 1fr))';

    function paint(c) {
      var s = +c.dataset.slot;
      if (mode === 'add') { selected.add(s); c.classList.add('on'); c.setAttribute('aria-pressed', 'true'); }
      else { selected['delete'](s); c.classList.remove('on'); c.setAttribute('aria-pressed', 'false'); }
    }
    function cellAt(x, y) {
      var t = document.elementFromPoint(x, y);
      return t && t.classList && t.classList.contains('cell') ? t : null;
    }
    function start(e, c) {
      var p = e.touches ? e.touches[0] : e; lx = p.clientX; ly = p.clientY;
      painting = true; mode = selected.has(+c.dataset.slot) ? 'remove' : 'add'; paint(c); lastCell = c;
      if (e.pointerId !== undefined && grid.setPointerCapture) { try { grid.setPointerCapture(e.pointerId); } catch (x) {} }
      e.preventDefault();
    }
    var lx = 0, ly = 0;
    function move(x, y) {
      if (!painting) return;
      // Interpolate so a fast swipe never skips cells between two move events.
      var dx = x - lx, dy = y - ly, steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 8));
      for (var i = 1; i <= steps; i++) {
        var c = cellAt(lx + dx * i / steps, ly + dy * i / steps);
        if (c && c !== lastCell) { paint(c); lastCell = c; }
      }
      lx = x; ly = y;
    }
    // Pointer events cover mouse + touch; touch events are the fallback (elementFromPoint in touchmove).
    var hasPointer = !!window.PointerEvent;
    if (hasPointer) {
      grid.addEventListener('pointerdown', function (e) { var c = e.target.closest('.cell'); if (c) start(e, c); });
      grid.addEventListener('pointermove', function (e) { move(e.clientX, e.clientY); });
      window.addEventListener('pointerup', function () { painting = false; lastCell = null; });
      window.addEventListener('pointercancel', function () { painting = false; lastCell = null; });
    } else {
      grid.addEventListener('mousedown', function (e) { var c = e.target.closest('.cell'); if (c) start(e, c); });
      grid.addEventListener('mousemove', function (e) { move(e.clientX, e.clientY); });
      window.addEventListener('mouseup', function () { painting = false; });
      grid.addEventListener('touchstart', function (e) { var t = e.touches[0], c = cellAt(t.clientX, t.clientY); if (c) start(e, c); }, { passive: false });
      grid.addEventListener('touchmove', function (e) { var t = e.touches[0]; move(t.clientX, t.clientY); e.preventDefault(); }, { passive: false });
      window.addEventListener('touchend', function () { painting = false; });
    }

    grid.appendChild(el('div', { 'class': 'gh' }));
    for (var d = 0; d < g.days; d++) {
      (function (d) {
        grid.appendChild(el('div', { 'class': 'gh', title: 'Tap to toggle the whole day', text: dayLabel(d), onclick: function () { toggleDay(d); } }));
      })(d);
    }
    for (var r = 0; r < g.perDay; r++) {
      var m = mins(ev.day_start) + r * ev.slot_minutes;
      grid.appendChild(el('div', { 'class': 'tl', text: ((m % 60 === 0 || ev.slot_minutes < 60) ? fmtTime(m) : '') + (m >= 1440 ? ' +1' : '') }));
      for (var d2 = 0; d2 < g.days; d2++) {
        var s = d2 * g.perDay + r;
        var c = el('button', { type: 'button', 'class': 'cell' + (selected.has(s) ? ' on' : ''), 'data-slot': s,
          'aria-pressed': selected.has(s) ? 'true' : 'false', 'aria-label': dayLabel(d2) + ' ' + fmtTime(m),
          onkeydown: function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); mode = selected.has(+this.dataset.slot) ? 'remove' : 'add'; paint(this); } } });
        cells[s] = c; grid.appendChild(c);
      }
    }
    function setSlots(pred) {
      cells.forEach(function (c, s) {
        var on = pred(s);
        if (on) selected.add(s); else selected['delete'](s);
        c.classList.toggle('on', on); c.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
    function toggleDay(d) {
      var all = true, i;
      for (i = 0; i < g.perDay; i++) if (!selected.has(d * g.perDay + i)) all = false;
      for (i = 0; i < g.perDay; i++) { mode = all ? 'remove' : 'add'; paint(cells[d * g.perDay + i]); }
    }
    function dow(d) { return dayDate(d).getUTCDay(); }
    function preset(minFrom, minTo, weekdaysOnly) {
      return function () {
        setSlots(function (s) {
          var d = Math.floor(s / g.perDay), m = slotTime(s);
          if (weekdaysOnly && (dow(d) === 0 || dow(d) === 6)) return false;
          return m >= minFrom && m + ev.slot_minutes <= minTo;
        });
      };
    }

    var status = el('div', { 'class': 'err', role: 'status' });
    var save = el('button', { 'class': 'btn', text: 'Submit availability', onclick: function () {
      save.disabled = true; status.textContent = '';
      api('/participants/' + me.id + '/slots', { method: 'PUT', body: JSON.stringify({ token: me.token, slots: Array.from(selected) }) })
        .then(function () { showDone(); })
        .catch(function (e) { status.textContent = e.message; save.disabled = false; });
    } });
    var chips = el('div', { 'class': 'chips' }, [
      el('button', { 'class': 'chip', type: 'button', text: 'Weekday evenings', onclick: preset(17 * 60, 22 * 60, true) }),
      el('button', { 'class': 'chip', type: 'button', text: 'All afternoon', onclick: preset(12 * 60, 17 * 60, false) }),
      el('button', { 'class': 'chip outline', type: 'button', text: 'Clear', onclick: function () { setSlots(function () { return false; }); } })
    ]);
    render(el('div', {}, [
      el('h1', { text: ev.title }),
      el('p', { text: 'Hi ' + me.name + '. Drag across the grid to paint when you are free; drag over painted cells to erase. Times in ' + ev.timezone + '.' }),
      chips, el('div', { 'class': 'gridwrap' }, [grid]), status, save
    ]));
  }

  function showDone() {
    var link = location.origin + location.pathname + '?p=' + me.id + '&t=' + me.token;
    store.set(me);
    var input = el('input', { value: link, readonly: 'readonly', 'aria-label': 'Your personal edit link' });
    var copy = el('button', { 'class': 'btn small', text: 'Copy', onclick: function () {
      input.select();
      (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).catch(function () { document.execCommand('copy'); });
      copy.textContent = 'Copied';
    } });
    render(el('div', {}, [
      el('h1', { text: 'Saved!' }),
      el('p', { text: 'Thanks ' + me.name + '. Bookmark your personal link to change your times later:' }),
      el('div', { 'class': 'card' }, [input, el('p', {}, [copy])]),
      el('button', { 'class': 'btn ghost', text: 'Edit my times', onclick: showPaint })
    ]));
  }

  function loadMine() {
    var saved = store.get();
    var id = qs.get('p'), t = qs.get('t');
    if (id && t) me = { id: +id, token: t };
    else if (saved) me = saved;
    if (!me) return Promise.resolve(false);
    return api('/participants/' + me.id + '/slots?token=' + encodeURIComponent(me.token))
      .then(function (r) { me.name = r.name; selected = new Set(r.slots); store.set(me); return true; })
      .catch(function () { me = null; return false; });
  }

  api('/events/' + slug).then(function (e) {
    ev = e;
    if (ev.final_slot !== null) return showFinal();
    return loadMine().then(function (ok) { ok ? showPaint() : showJoin(); });
  }).catch(function (e) { render(el('p', { 'class': 'err', text: e.message })); });
})();
