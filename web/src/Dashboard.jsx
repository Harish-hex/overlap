import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api, dayLabel, fmtTime, mins, rangeLabel, slotMinutes } from './util.js';

const POLL_MS = 4000;

export default function Dashboard({ slug, token }) {
  const [ev, setEv] = useState(null);
  const [heat, setHeat] = useState({ participants: [], slots: {} });
  const [sug, setSug] = useState([]);
  const [err, setErr] = useState('');
  const [hover, setHover] = useState(null);
  const [sel, setSel] = useState(null);
  const timer = useRef();

  const refresh = useCallback(async () => {
    try {
      const [h, s, e] = await Promise.all([
        api(`/events/${slug}/heatmap`), api(`/events/${slug}/suggest`), api(`/events/${slug}?admin=${token}`)]);
      setHeat(h); setSug(s.suggestions); setEv(e); setErr('');
    } catch (x) { setErr(x.message); }
  }, [slug, token]);

  useEffect(() => {
    refresh();
    timer.current = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer.current);
  }, [refresh]);

  async function finalize(slot) {
    try {
      await api(`/events/${slug}/finalize`, { method: 'POST', body: JSON.stringify({ admin_token: token, slot }) });
      setSel(null); refresh();
    } catch (x) { setErr(x.message); }
  }

  if (!ev) return <p>{err ? <span className="err">{err}</span> : 'Loading…'}</p>;
  if (!ev.is_admin) return <p className="err">This admin link is not valid.</p>;

  const g = ev.grid;
  const n = heat.participants.length;
  const top = new Set(sug.length ? Array.from({ length: g.k }, (_, i) => sug[0].slot + i) : []);
  const share = `${location.origin}/e/${slug}`;
  const highlight = sel === null ? null : new Set(Array.from({ length: g.k }, (_, i) => sel + i));

  return (
    <div>
      <h1>{ev.title}</h1>
      <p className="muted">{n} {n === 1 ? 'response' : 'responses'} · times in {ev.timezone} · refreshes every {POLL_MS / 1000}s</p>
      <div className="card">
        <label htmlFor="share" style={{ marginTop: 0 }}>Share link</label>
        <input id="share" readOnly value={share} onFocus={(e) => e.target.select()} />
      </div>
      {err && <div className="err" role="alert">{err}</div>}

      {ev.final_slot !== null ? (
        <div className="final-box">
          <p className="muted">Locked</p>
          <div className="big">{rangeLabel(ev, ev.final_slot)}</div>
          <p><button className="btn ghost small" onClick={() => finalize(null)}>Unlock</button></p>
        </div>
      ) : (
        <div className="card">
          <h2>Best times</h2>
          {sug.length === 0 && <p className="muted">Suggestions appear once someone responds.</p>}
          {sug.map((s) => (
            <div className="sug" key={s.slot}>
              <div>
                <strong>{rangeLabel(ev, s.slot)}</strong><br />
                <span className="muted">{s.free.length}/{n} free{s.missing.length ? ` · missing: ${s.missing.join(', ')}` : ' · everyone'}</span>
              </div>
              <button className="btn small nowrap" onClick={() => finalize(s.slot)}>Lock this time</button>
            </div>
          ))}
        </div>
      )}

      <h2>Heatmap</h2>
      <p className="muted">Darker ink = more people free. Hover or tap a cell to see who. Tap to preview a meeting window.</p>
      <div className="gridwrap">
        <div className="grid" style={{ gridTemplateColumns: `auto repeat(${g.days}, minmax(52px, 1fr))` }} onMouseLeave={() => setHover(null)}>
          <div className="gh" />
          {Array.from({ length: g.days }, (_, d) => <div className="gh" key={d}>{dayLabel(ev, d)}</div>)}
          {Array.from({ length: g.perDay }, (_, r) => {
            const m = mins(ev.day_start) + r * ev.slot_minutes;
            return (
              <React.Fragment key={r}>
                <div className="tl">{fmtTime(m)}</div>
                {Array.from({ length: g.days }, (_, d) => {
                  const s = d * g.perDay + r;
                  const names = heat.slots[s] || [];
                  const cls = ['cell', 'heat', top.has(s) && 'top',
                    ev.final_slot !== null && s >= ev.final_slot && s < ev.final_slot + g.k && 'final',
                    highlight?.has(s) && 'sel'].filter(Boolean).join(' ');
                  return (
                    <button key={d} type="button" className={cls}
                      style={{ '--d': n ? names.length / n : 0 }}
                      aria-label={`${dayLabel(ev, d)} ${fmtTime(m)}: ${names.length} of ${n} free`}
                      onMouseEnter={(e) => setHover({ names, x: e.clientX, y: e.clientY, label: `${dayLabel(ev, d)} ${fmtTime(m)}` })}
                      onMouseMove={(e) => setHover((h) => h && { ...h, x: e.clientX, y: e.clientY })}
                      onClick={(e) => { setSel(s); setHover({ names, x: e.clientX, y: e.clientY, label: `${dayLabel(ev, d)} ${fmtTime(m)}` }); }} />
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>
      {sel !== null && ev.final_slot === null && (
        <p><button className="btn small" onClick={() => finalize(sel)}>Lock {rangeLabel(ev, sel)}</button></p>
      )}
      {hover && (
        <div className="tip" style={{ left: Math.min(hover.x + 12, window.innerWidth - 250), top: hover.y + 14 }}>
          <strong>{hover.label}</strong><br />
          {hover.names.length ? hover.names.join(', ') : 'Nobody free'}
        </div>
      )}
    </div>
  );
}
