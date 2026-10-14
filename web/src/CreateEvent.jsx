import React, { useState } from 'react';
import { api } from './util.js';

const today = () => new Date().toISOString().slice(0, 10);
const plus = (d, n) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);

export default function CreateEvent() {
  const [f, setF] = useState({
    title: '', start_date: today(), end_date: plus(today(), 6), day_start: '09:00', day_end: '18:00',
    slot_minutes: 30, meeting_length: 60,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  function validate() {
    if (!f.title.trim()) return 'Give the event a title.';
    if (f.end_date < f.start_date) return 'End date is before the start date.';
    if (f.day_end <= f.day_start) return 'The daily window must end after it starts.';
    return '';
  }
  async function submit(e) {
    e.preventDefault();
    const v = validate();
    if (v) return setErr(v);
    setBusy(true); setErr('');
    try {
      const r = await api('/events', { method: 'POST', body: JSON.stringify({ ...f, slot_minutes: +f.slot_minutes, meeting_length: +f.meeting_length }) });
      setDone(r);
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }

  if (done) {
    const share = location.origin + done.share_path;
    const admin = location.origin + done.admin_path;
    return (
      <div>
        <h1>Event created</h1>
        <div className="card">
          <h3>Share link <span className="muted">(send to the group)</span></h3>
          <input readOnly value={share} onFocus={(e) => e.target.select()} aria-label="Share link" />
          <h3 style={{ marginTop: 16 }}>Admin link <span className="muted">(private, keep it to yourself)</span></h3>
          <input readOnly value={admin} onFocus={(e) => e.target.select()} aria-label="Admin link" />
        </div>
        <a className="btn" href={done.admin_path.replace('/app/', '')} style={{ textDecoration: 'none', display: 'inline-block' }}>Open dashboard</a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <h1>Find the time<br />you all overlap.</h1>
      <p>Create an event, share one link, let everyone paint their free slots.</p>
      <label htmlFor="title">Event title</label>
      <input id="title" value={f.title} onChange={set('title')} maxLength={120} placeholder="Study group sync" />
      <div className="row">
        <div><label htmlFor="sd">From</label><input id="sd" type="date" value={f.start_date} onChange={set('start_date')} /></div>
        <div><label htmlFor="ed">To</label><input id="ed" type="date" value={f.end_date} onChange={set('end_date')} /></div>
        <div><label htmlFor="ds">Day starts</label><input id="ds" type="time" value={f.day_start} onChange={set('day_start')} /></div>
        <div><label htmlFor="de">Day ends</label><input id="de" type="time" value={f.day_end} onChange={set('day_end')} /></div>
        <div>
          <label htmlFor="sm">Slot size</label>
          <select id="sm" value={f.slot_minutes} onChange={set('slot_minutes')}>
            <option value={15}>15 min</option><option value={30}>30 min</option><option value={60}>60 min</option>
          </select>
        </div>
        <div>
          <label htmlFor="ml">Meeting length</label>
          <select id="ml" value={f.meeting_length} onChange={set('meeting_length')}>
            {[15, 30, 45, 60, 90, 120, 180].map((m) => <option key={m} value={m}>{m >= 60 ? `${m / 60} h` : `${m} min`}</option>)}
          </select>
        </div>
      </div>
      <label htmlFor="tz">Time zone</label>
      <input id="tz" value={f.timezone} onChange={set('timezone')} />
      <div className="err" role="alert">{err}</div>
      <button className="btn" disabled={busy}>{busy ? 'Creating…' : 'Create event'}</button>
    </form>
  );
}
