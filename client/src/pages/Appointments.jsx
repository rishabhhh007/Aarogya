import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const pad = (n) => String(n).padStart(2, '0');
const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shift = (s, days) => { const d = new Date(`${s}T00:00:00`); d.setDate(d.getDate() + days); return toStr(d); };
const pretty = (s) => new Date(`${s}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const to12 = (t) => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`; };

function Modal({ title, onClose, children }) {
  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>{title}</h2><button className="x" onClick={onClose}>✕</button></div>
        {children}
      </div>
    </div>,
    document.body
  );
}

/* Grid of time slots for a doctor on a date */
function SlotPicker({ doctor, date, value, onChange }) {
  const [slots, setSlots] = useState([]);
  useEffect(() => {
    if (!doctor || !date) return setSlots([]);
    api.get('/appointments/slots', { params: { doctor, date } }).then((r) => setSlots(r.data));
  }, [doctor, date]);

  if (!doctor) return <p className="muted">Select a doctor to see time slots.</p>;
  if (slots.length && !slots.some((s) => s.available)) return <p className="err" style={{ textAlign: 'left' }}>No free slots on this day. Try another date.</p>;
  return (
    <div className="slots">
      {slots.map((s) => (
        <button type="button" key={s.time} disabled={!s.available}
          className={`slot ${value === s.time ? 'on' : ''}`} onClick={() => onChange(s.time)}>{to12(s.time)}</button>
      ))}
    </div>
  );
}

/* ---------- Book ---------- */
function BookModal({ doctors, date: d0, doctor: doc0, onClose, onSaved }) {
  const [patients, setPatients] = useState([]);
  const [f, setF] = useState({ patient: '', doctor: doc0 || '', date: d0, time: '', reason: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/patients').then((r) => setPatients(r.data)); }, []);

  // changing doctor or date clears the chosen time
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value, ...(k === 'doctor' || k === 'date' ? { time: '' } : {}) });

  const submit = async (e) => {
    e.preventDefault();
    if (!f.time) return setErr('Pick a time slot');
    setErr(''); setBusy(true);
    try { await api.post('/appointments', f); onSaved('Appointment booked', f.date, f.doctor); }
    catch (e) { setErr(e.response?.data?.message || 'Could not book'); setBusy(false); }
  };

  return (
    <Modal title="Book appointment" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="grid2">
          <div><label>Patient *</label>
            <select value={f.patient} onChange={set('patient')} required>
              <option value="">Select patient</option>
              {patients.map((p) => <option key={p._id} value={p._id}>{p.name} ({p.patientId})</option>)}
            </select></div>
          <div><label>Doctor *</label>
            <select value={f.doctor} onChange={set('doctor')} required>
              <option value="">Select doctor</option>
              {doctors.map((d) => <option key={d._id} value={d._id}>{d.name} ({d.specialization})</option>)}
            </select></div>
          <div><label>Date *</label><input type="date" min={toStr(new Date())} value={f.date} onChange={set('date')} required /></div>
        </div>
        <p className="section-title">Time slot</p>
        <SlotPicker doctor={f.doctor} date={f.date} value={f.time} onChange={(time) => setF({ ...f, time })} />
        <div style={{ marginTop: 12 }}>
          <label>Reason (optional)</label>
          <input value={f.reason} onChange={set('reason')} placeholder="e.g. Follow-up, chest pain" />
        </div>
        {err && <p className="err" style={{ textAlign: 'left' }}>{err}</p>}
        <div className="actions">
          <button className="btn" disabled={busy}>{busy ? 'Booking...' : 'Book appointment'}</button>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- Reschedule ---------- */
function RescheduleModal({ appt, onClose, onSaved }) {
  const [date, setDate] = useState(appt.date);
  const [time, setTime] = useState('');
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!time) return setErr('Pick a new time slot');
    try { await api.put(`/appointments/${appt._id}/reschedule`, { date, time }); onSaved('Appointment rescheduled', date, appt.doctor?._id); }
    catch (e) { setErr(e.response?.data?.message || 'Could not reschedule'); }
  };

  return (
    <Modal title={`Reschedule: ${appt.patient?.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="muted" style={{ margin: 0 }}>{appt.doctor?.name} · currently {appt.date} at {to12(appt.time)}</p>
        <label>New date</label>
        <input type="date" min={toStr(new Date())} value={date} onChange={(e) => { setDate(e.target.value); setTime(''); }} style={{ maxWidth: 220 }} />
        <p className="section-title">New time slot</p>
        <SlotPicker doctor={appt.doctor?._id} date={date} value={time} onChange={setTime} />
        {err && <p className="err" style={{ textAlign: 'left' }}>{err}</p>}
        <div className="actions">
          <button className="btn">Save new time</button>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- Page ---------- */
export default function Appointments() {
  const { user } = useAuth();
  const isDoctor = user.role === 'doctor';
  const [date, setDate] = useState(toStr(new Date()));
  const [doctor, setDoctor] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [book, setBook] = useState(false);
  const [resched, setResched] = useState(null);
  const [toast, setToast] = useState(null);

  const load = () =>
    api.get('/appointments', { params: { date, doctor } }).then((r) => setRows(r.data)).finally(() => setLoading(false));

  useEffect(() => { load(); }, [date, doctor]);
  useEffect(() => { api.get('/patients/doctors').then((r) => setDoctors(r.data)); }, []);

  const say = (ok, text) => { setToast({ ok, text }); setTimeout(() => setToast(null), 3000); };
  const saved = (text, d, doc) => {
  setBook(false); setResched(null);
  const dayChanged = d && d !== date;
  const doctorHidden = doctor && doc && doctor !== doc;
  if (dayChanged) setDate(d);          // jump to the day that was just booked
  if (doctorHidden) setDoctor('');     // stop the doctor filter from hiding it
  say(true, d ? `${text} for ${pretty(d)}` : text);
  if (!dayChanged && !doctorHidden) load(); // otherwise the date/doctor change reloads the list
};
  const setStatus = async (a, status) => {
    if (status === 'cancelled' && !window.confirm(`Cancel ${a.patient?.name}'s appointment?`)) return;
    try { await api.put(`/appointments/${a._id}/status`, { status }); say(true, status === 'completed' ? 'Marked as completed' : 'Appointment cancelled'); load(); }
    catch (e) { say(false, e.response?.data?.message || 'Something went wrong'); }
  };

  const count = (s) => rows.filter((r) => r.status === s).length;

  return (
    <section className="card">
      <div className="toolbar">
        <div className="datebar">
          <button className="btn ghost-blue small" onClick={() => setDate(shift(date, -1))}>‹</button>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button className="btn ghost-blue small" onClick={() => setDate(shift(date, 1))}>›</button>
          <button className="btn ghost-blue small" onClick={() => setDate(toStr(new Date()))}>Today</button>
        </div>
        {!isDoctor && (
          <div className="datebar">
            <select className="search" style={{ width: 220 }} value={doctor} onChange={(e) => setDoctor(e.target.value)}>
              <option value="">All doctors</option>
              {doctors.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
            <button className="btn" onClick={() => setBook(true)}>+ Book appointment</button>
          </div>
        )}
      </div>

      <p className="muted" style={{ margin: '0 0 10px' }}>
        <b>{pretty(date)}</b> · {count('scheduled')} scheduled · {count('completed')} completed · {count('cancelled')} cancelled
      </p>
      {toast && <p className={toast.ok ? 'ok' : 'err'} style={{ textAlign: 'left' }}>{toast.text}</p>}

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Time</th><th>Patient</th>{!isDoctor && <th>Doctor</th>}<th>Reason</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a._id} className={a.status === 'cancelled' ? 'dim' : ''}>
                <td><b>{to12(a.time)}</b></td>
                <td>{a.patient?.name} <span className="muted">{a.patient?.patientId}</span></td>
                {!isDoctor && <td>{a.doctor?.name}<br /><span className="muted">{a.doctor?.specialization}</span></td>}
                <td>{a.reason || '—'}</td>
                <td><span className={`tag ${a.status}`}>{a.status}</span></td>
                <td className="row-actions">
                  {a.status === 'scheduled' && (
                    <>
                      <button className="btn small" onClick={() => setStatus(a, 'completed')}>Complete</button>
                      {!isDoctor && <button className="btn ghost-blue small" onClick={() => setResched(a)}>Reschedule</button>}
                      {!isDoctor && <button className="btn danger" onClick={() => setStatus(a, 'cancelled')}>Cancel</button>}
                    </>
                  )}
                </td>
              </tr>
            ))}
            {!loading && !rows.length && <tr><td colSpan="6">No appointments on this day</td></tr>}
          </tbody>
        </table>
      </div>

      {book && <BookModal doctors={doctors} date={date < toStr(new Date()) ? toStr(new Date()) : date} doctor={doctor} onClose={() => setBook(false)} onSaved={saved} />}
      {resched && <RescheduleModal appt={resched} onClose={() => setResched(null)} onSaved={saved} />}
    </section>
  );
}