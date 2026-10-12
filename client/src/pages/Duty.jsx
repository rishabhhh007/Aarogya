import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import ShiftModal from '../components/ShiftModal';
import { SHIFTS, toStr, addDays, pretty, sortDuties } from '../shifts';

export default function Duty() {
  const today = toStr();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(null);   // duty | 'extra'
  const [toast, setToast] = useState('');

  const load = () => api.get('/duties', { params: { from: today, to: addDays(today, 14) } })
    .then((r) => setRows(r.data.sort(sortDuties))).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const days = [...new Set(rows.map((r) => r.date))];
  const todays = rows.filter((r) => r.date === today);

  return (
    <div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <div>
            <h3 style={{ margin: 0 }}>Today</h3>
            <p style={{ margin: '6px 0 0', fontSize: 16 }}>
              {todays.length
                ? todays.map((d) => <span key={d._id} className="duty-now">{SHIFTS[d.shift].icon} {SHIFTS[d.shift].label} · {d.ward?.name}</span>)
                : <span className="muted">No ward duty today.</span>}
            </p>
          </div>
          <div className="actions" style={{ margin: 0 }}>
            <Link className="btn" to="/priority">See priority patients</Link>
            <button className="btn ghost-blue" onClick={() => setEdit('extra')}>+ Take extra shift</button>
          </div>
        </div>
      </div>
      {toast && <p className="ok">{toast}</p>}

      {days.map((date) => (
        <div className="card day-card" key={date}>
          <h3 style={{ textTransform: 'none', letterSpacing: 0, fontSize: 15, color: 'var(--text)' }}>{pretty(date)} {date === today && <span className="tag admitted">today</span>}</h3>
          {rows.filter((r) => r.date === date).map((d) => {
            const last = d.changes?.[d.changes.length - 1];
            return (
              <div className="duty-row" key={d._id}>
                <div className="duty-shift">{SHIFTS[d.shift].icon}<div><b>{SHIFTS[d.shift].label}</b><small>{SHIFTS[d.shift].time}</small></div></div>
                <div style={{ flex: 1 }}>
                  <b>{d.ward?.name}</b> <span className="tag outpatient">{d.ward?.type}</span>
                  {last && <div className="muted">Adjusted{last.fromShift ? `: ${SHIFTS[last.fromShift]?.label} · ${last.fromWard} →` : ' —'} {last.reason}{last.patientName ? ` (${last.patientName})` : ''}</div>}
                </div>
                <button className="btn ghost-blue small" onClick={() => setEdit(d)}>Change shift / ward</button>
              </div>
            );
          })}
        </div>
      ))}
      {!loading && !rows.length && <div className="card">No duties assigned for the next 14 days. The admin assigns them from the Duty Roster.</div>}

      {edit && (
        <ShiftModal duties={edit === 'extra' ? [] : [edit]} date={edit === 'extra' ? today : edit.date}
          onClose={() => setEdit(null)} onSaved={(t) => { setEdit(null); setToast(t); load(); setTimeout(() => setToast(''), 3000); }} />
      )}
    </div>
  );
}