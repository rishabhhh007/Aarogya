import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';

const LABEL = { doctors: 'Doctor', receptionists: 'Receptionist' };
const DEPARTMENTS = ['General Medicine', 'Cardiology', 'Orthopedics', 'Pediatrics', 'Gynecology',
  'ENT', 'Neurology', 'Dermatology', 'Radiology', 'Emergency'];

export default function StaffForm({ type }) {
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', phone: '', specialization: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await api.post(`/staff/${type}`, f);
      nav(`/${type}`);
    } catch (e) {
      setErr(e.response?.data?.message || 'Could not save');
      setBusy(false);
    }
  };

  return (
    <form className="card form wide" onSubmit={submit}>
      <h3>New {LABEL[type]}</h3>
      <div className="grid2">
        <div><label>Full name</label><input value={f.name} onChange={set('name')} required /></div>
        <div><label>Phone</label><input value={f.phone} onChange={set('phone')} /></div>
        <div><label>Email (used to log in)</label><input type="email" value={f.email} onChange={set('email')} required /></div>
        <div><label>Temporary password</label><input type="text" value={f.password} onChange={set('password')} minLength={6} required /></div>
        {type === 'doctors' && (
          <div>
            <label>Specialization</label>
            <select value={f.specialization} onChange={set('specialization')} required>
              <option value="">Select department</option>
              {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
        )}
      </div>
      {err && <p className="err" style={{ textAlign: 'left' }}>{err}</p>}
      <div className="actions">
        <button className="btn" disabled={busy}>{busy ? 'Saving...' : `Save ${LABEL[type]}`}</button>
        <Link className="btn ghost" to={`/${type}`}>Cancel</Link>
      </div>
    </form>
  );
}