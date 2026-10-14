export async function api(path, opts) {
  const r = await fetch('/api' + path, opts);
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
}
const pad = (n) => String(n).padStart(2, '0');
export const mins = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const fmtTime = (m) => `${pad(Math.floor((m % 1440) / 60))}:${pad(m % 60)}`;
export const dayDate = (ev, i) => new Date(Date.parse(ev.start_date + 'T00:00:00Z') + i * 864e5);
export const dayLabel = (ev, i) =>
  dayDate(ev, i).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
export const slotMinutes = (ev, s) => mins(ev.day_start) + (s % ev.grid.perDay) * ev.slot_minutes;
export const rangeLabel = (ev, s) => {
  const m = slotMinutes(ev, s); // may pass 1440 for overnight windows: the real date is then the next day
  return `${dayLabel(ev, Math.floor(s / ev.grid.perDay) + Math.floor(m / 1440))}, ${fmtTime(m)}–${fmtTime(m + ev.meeting_length)} (${ev.timezone})`;
};
