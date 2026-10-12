import { useEffect, useState } from 'react';
import api from '../api';
import { SHIFTS, ORDER, toStr, addDays, pretty, sortDuties } from '../shifts';

export default function Roster() {
  const [from, setFrom] = useState(toStr());
  const [rows, setRows] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [wards, setWards] = useState([]);
  const [f, setF] = useState({ doctor: '', ward: '', date: toStr(), shift: 'morning', days: 1 });
  const [toast, setToast] = useState(null);
  const to = addDays(from, 6);

  const load = () => api.get('/duties', { params: { from, to } }).then((r) => setRows(r.data.sort(sortDuties)));
  useEffect(() => { load(); }, [from]);
  useEffect(() => {
    api.get('/patients/doctors').then((r) => setDoctors(r.data));
    api.get('/duties/wards').then((r) => setWards(r.data));
  }, []);

  const say = (ok, text) => { setToast({ ok, text }); setTimeout(() => setToast(null), 3500); };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const assign = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/duties', f);
      say(true, `${data.created} duty added${data.skipped ? `, ${data.skipped} skipped (already assigned)` : ''}`);
      if (f.date < from || f.date > to) setFrom(f.date); else load();
    } catch (e) { say(false, e.response?.data?.message || 'Could not assign'); }
  };
  const remove = async (d) => {
    if (!window.confirm(`Remove ${d.doctor?.name}'s ${SHIFTS[d.shift].label} duty?`)) return;
    try { await api.delete(`/duties/${d._id}`); load(); } catch (e) { say(false, e.response?.data?.message || 'Could not remove'); }
  };

  return (
    <div>
      <form className="card form" onSubmit={assign} style={{ marginBottom: 14 }}>
        <h3>Assign duty</h3>
        <div className="grid2">
          <div><label>Doctor *</label>
            <select value={f.doctor} onChange={set('doctor')} required>
              <option value="">Select doctor</option>{doctors.map((d) => <option key={d._id} value={d._id}>{d.name} ({d.specialization})</option>)}
            </select></div>
          <div><label>Ward *</label>
            <select value={f.ward} onChange={set('ward')} required>
              <option value="">Select ward</option>{wards.map((w) => <option key={w._id} value={w._id}>{w.name} ({w.type})</option>)}
            </select></div>
          <div><label>Shift *</label>
            <select value={f.shift} onChange={set('shift')}>{ORDER.map((s) => <option key={s} value={s}>{SHIFTS[s].label} ({SHIFTS[s].time})</option>)}</select></div>
          <div><label>Start date *</label><input type="date" min={toStr()} value={f.date} onChange={set('date')} required /></div>
          <div><label>For how many days (1 to 14)</label><input type="number" min="1" max="14" value={f.days} onChange={set('days')} /></div>
        </div>
        {toast && <p className={toast.ok ? 'ok' : 'err'} style={{ textAlign: 'left' }}>{toast.text}</p>}
        <div className="actions"><button className="btn">Assign duty</button></div>
      </form>

      <div className="toolbar">
        <div className="datebar">
          <button className="btn ghost-blue small" onClick={() => setFrom(addDays(from, -7))}>‹ Previous week</button>
          <b>{pretty(from)} – {pretty(to)}</b>
          <button className="btn ghost-blue small" onClick={() => setFrom(addDays(from, 7))}>Next week ›</button>
          <button className="btn ghost-blue small" onClick={() => setFrom(toStr())}>This week</button>
        </div>
      </div>

      <div className="roster">
        {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((date) => (
          <div className="card day-card" key={date}>
            <h3 style={{ textTransform: 'none', letterSpacing: 0, fontSize: 14, color: 'var(--text)' }}>{pretty(date)} {date === toStr() && <span className="tag admitted">today</span>}</h3>
            {rows.filter((r) => r.date === date).map((d) => {
              const last = d.changes?.[d.changes.length - 1];
              return (
                <div className="duty-row" key={d._id}>
                  <div className="duty-shift">{SHIFTS[d.shift].icon}<div><b>{SHIFTS[d.shift].label}</b></div></div>
                  <div style={{ flex: 1 }}>
                    <b>{d.doctor?.name}</b> <span className="muted">{d.doctor?.specialization}</span><br />
                    {d.ward?.name}
                    {last && <span className="tag scheduled" title={last.reason} style={{ marginLeft: 8 }}>adjusted: {last.reason}</span>}
                  </div>
                  <button className="x" title="Remove" onClick={() => remove(d)}>🗑</button>
                </div>
              );
            })}
            {!rows.some((r) => r.date === date) && <p className="muted" style={{ margin: 0 }}>No duties</p>}
          </div>
        ))}
      </div>
    </div>
  );
}