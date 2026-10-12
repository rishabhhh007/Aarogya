import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { createPortal } from 'react-dom';
import CareModal from '../components/CareModal';

const TABS = ['all', 'admitted', 'outpatient', 'discharged'];
const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const EMPTY = { name: '', age: '', gender: '', phone: '', bloodGroup: '', address: '', emergencyName: '',
  emergencyPhone: '', allergies: '', complaint: '', doctor: '', status: 'outpatient', bedId: '' };
const bedLabel = (b) => (b ? `${b.room?.ward?.name} · Room ${b.room?.number} · ${b.number}` : null);
const fmt = (d) => (d ? new Date(d).toLocaleString() : '—');

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

/* ---------- Register / edit form ---------- */
function PatientForm({ patient, doctors, onClose, onSaved }) {
  const edit = !!patient;
  const [f, setF] = useState(edit ? { ...EMPTY, ...patient, doctor: patient.doctor?._id || '' } : EMPTY);
  const [beds, setBeds] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => { if (!edit) api.get('/patients/beds/available').then((r) => setBeds(r.data)); }, [edit]);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      edit ? await api.put(`/patients/${patient._id}`, f) : await api.post('/patients', f);
      onSaved(edit ? 'Patient updated' : 'Patient registered');
    } catch (e) { setErr(e.response?.data?.message || 'Could not save'); setBusy(false); }
  };

  return (
    <Modal title={edit ? `Edit ${patient.name}` : 'Register patient'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="section-title">Personal details</p>
        <div className="grid2">
          <div><label>Full name *</label><input value={f.name} onChange={set('name')} required /></div>
          <div><label>Phone * (10 digits)</label><input value={f.phone} onChange={set('phone')} required /></div>
          <div><label>Age *</label><input type="number" min="0" max="120" value={f.age} onChange={set('age')} required /></div>
          <div><label>Gender *</label>
            <select value={f.gender} onChange={set('gender')} required>
              <option value="">Select</option><option>Male</option><option>Female</option><option>Other</option>
            </select></div>
          <div><label>Blood group</label>
            <select value={f.bloodGroup} onChange={set('bloodGroup')}>
              <option value="">Unknown</option>{BLOOD.map((b) => <option key={b}>{b}</option>)}
            </select></div>
          <div><label>Address</label><input value={f.address} onChange={set('address')} /></div>
          <div><label>Emergency contact name</label><input value={f.emergencyName} onChange={set('emergencyName')} /></div>
          <div><label>Emergency contact phone</label><input value={f.emergencyPhone} onChange={set('emergencyPhone')} /></div>
        </div>

        <p className="section-title">Medical details</p>
        <div className="grid2">
          <div><label>Reason for visit *</label><input value={f.complaint} onChange={set('complaint')} required /></div>
          <div><label>Known allergies</label><input value={f.allergies} onChange={set('allergies')} placeholder="e.g. Penicillin" /></div>
          <div><label>Consulting doctor</label>
            <select value={f.doctor} onChange={set('doctor')}>
              <option value="">Not assigned</option>
              {doctors.map((d) => <option key={d._id} value={d._id}>{d.name} ({d.specialization})</option>)}
            </select></div>
          {edit && <div><label>Diagnosis</label><input value={f.diagnosis} onChange={set('diagnosis')} /></div>}
        </div>

        {!edit && (
          <>
            <p className="section-title">Visit type</p>
            <div className="grid2">
              <div><label>Patient type</label>
                <select value={f.status} onChange={set('status')}>
                  <option value="outpatient">Outpatient (no bed)</option>
                  <option value="admitted">Admit to a bed</option>
                </select></div>
              {f.status === 'admitted' && (
                <div><label>Bed (can be assigned later)</label>
                  <select value={f.bedId} onChange={set('bedId')}>
                    <option value="">{beds.length ? 'Assign later' : 'No free beds'}</option>
                    {beds.map((b) => <option key={b._id} value={b._id}>{b.label}</option>)}
                  </select></div>
              )}
            </div>
          </>
        )}

        {err && <p className="err" style={{ textAlign: 'left' }}>{err}</p>}
        <div className="actions">
          <button className="btn" disabled={busy}>{busy ? 'Saving...' : edit ? 'Save changes' : 'Register patient'}</button>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- Details + bed assignment ---------- */
function PatientDetail({ id, canWrite, isAdmin, onClose, onChanged, onEdit }) {
  const [p, setP] = useState(null);
  const [beds, setBeds] = useState([]);
  const [bedId, setBedId] = useState('');
  const [msg, setMsg] = useState(null);
  const [care, setCare] = useState(false);

  const load = () => api.get(`/patients/${id}`).then((r) => setP(r.data));
  const loadBeds = () => api.get('/patients/beds/available').then((r) => setBeds(r.data));
  useEffect(() => { load(); if (canWrite) loadBeds(); }, [id]);

  const act = async (fn, text) => {
    try { await fn(); setMsg({ ok: true, text }); setBedId(''); await load(); if (canWrite) loadBeds(); onChanged(); }
    catch (e) { setMsg({ ok: false, text: e.response?.data?.message || 'Something went wrong' }); }
  };

  if (!p) return <Modal title="Loading..." onClose={onClose}><p className="muted">Please wait</p></Modal>;
  const row = (k, v) => <><dt>{k}</dt><dd>{v || '—'}</dd></>;

  return (
    <Modal title={p.name} onClose={onClose}>
      <p style={{ margin: '-6px 0 14px' }}>
        <span className="muted">{p.patientId} </span><span className={`tag ${p.status}`}>{p.status}</span>
      </p>
      <dl>
        {row('Age / Gender', `${p.age ?? '—'} / ${p.gender || '—'}`)}
        {row('Phone', p.phone)}
        {row('Blood group', p.bloodGroup)}
        {row('Address', p.address)}
        {row('Emergency contact', p.emergencyName ? `${p.emergencyName} (${p.emergencyPhone || 'no phone'})` : '')}
        {row('Allergies', p.allergies)}
        {row('Reason for visit', p.complaint)}
        {row('Diagnosis', p.diagnosis)}
        {row('Doctor', p.doctor ? `${p.doctor.name} (${p.doctor.specialization})` : '')}
        {row('Bed', bedLabel(p.bed))}
        {row('Registered', fmt(p.createdAt))}
        {p.admittedAt && row('Admitted', fmt(p.admittedAt))}
        {p.dischargedAt && row('Discharged', fmt(p.dischargedAt))}
      </dl>

      {canWrite && p.status !== 'discharged' && (
        <div className="assign">
          <label>{p.bed ? 'Move to another bed' : 'Assign a bed'}</label>
          <div className="assign-row">
            <select value={bedId} onChange={(e) => setBedId(e.target.value)}>
              <option value="">{beds.length ? 'Select an available bed' : 'No free beds'}</option>
              {beds.map((b) => <option key={b._id} value={b._id}>{b.label}</option>)}
            </select>
            <button className="btn" disabled={!bedId} onClick={() => act(() => api.post(`/patients/${id}/assign-bed`, { bedId }), 'Bed assigned')}>
              {p.bed ? 'Move' : 'Assign'}
            </button>
          </div>
        </div>
      )}

      {msg && <p className={msg.ok ? 'ok' : 'err'} style={{ textAlign: 'left' }}>{msg.text}</p>}

      <div className="actions">
        {canWrite && <button className="btn" onClick={() => onEdit(p)}>Edit details</button>}
        {canWrite && p.status !== 'discharged' && (
          <button className="btn danger" onClick={() => window.confirm(`Discharge ${p.name}? The bed will be freed.`) && act(() => api.post(`/patients/${id}/discharge`), 'Patient discharged')}>Discharge</button>
        )}
        {isAdmin && (
          <button className="btn danger" onClick={async () => {
            if (!window.confirm(`Permanently delete ${p.name}?`)) return;
            await api.delete(`/patients/${id}`); onChanged(); onClose();
          }}>Delete</button>
        )}
        <button className="btn ghost-blue" onClick={() => setCare(true)}>Vitals & labs</button>
        {care && <CareModal patient={p} onClose={() => setCare(false)} />}
        <button className="btn ghost" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

/* ---------- Main page ---------- */
export default function Patients() {
  const { user } = useAuth();
  const canWrite = user.role === 'admin' || user.role === 'receptionist';
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState([]);
  const [form, setForm] = useState(null);   // null | 'new' | patient object
  const [detailId, setDetailId] = useState(null);
  const [toast, setToast] = useState('');

  const load = () =>
    api.get('/patients', { params: { q, status: tab === 'all' ? '' : tab } })
      .then((r) => setRows(r.data)).finally(() => setLoading(false));

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q, tab]);
  useEffect(() => { api.get('/patients/doctors').then((r) => setDoctors(r.data)); }, []);

  const saved = (text) => { setForm(null); setToast(text); load(); setTimeout(() => setToast(''), 3000); };

  return (
    <section className="card">
      <div className="toolbar">
        <input className="search" placeholder="Search by name, phone or ID..." value={q} onChange={(e) => setQ(e.target.value)} />
        {canWrite && <button className="btn" onClick={() => setForm('new')}>+ Register Patient</button>}
      </div>

      <div className="tabs">
        {TABS.map((t) => <button key={t} className={`tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      {toast && <p className="ok">{toast}</p>}

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr><th>ID</th><th>Patient</th><th>Age / Gender</th><th>Phone</th><th>Doctor</th><th>Bed</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p._id}>
                <td className="muted">{p.patientId}</td>
                <td><button className="link" onClick={() => setDetailId(p._id)}>{p.name}</button></td>
                <td>{p.age ?? '—'} / {p.gender || '—'}</td>
                <td>{p.phone}</td>
                <td>{p.doctor?.name || '—'}</td>
                <td>
                  {p.bed ? bedLabel(p.bed)
                    : p.status === 'admitted' && canWrite
                      ? <button className="btn small" onClick={() => setDetailId(p._id)}>Assign bed</button>
                      : '—'}
                </td>
                <td><span className={`tag ${p.status}`}>{p.status}</span></td>
              </tr>
            ))}
            {!loading && !rows.length && <tr><td colSpan="7">{q || tab !== 'all' ? 'No patients match' : 'No patients registered yet'}</td></tr>}
          </tbody>
        </table>
      </div>

      {form && <PatientForm patient={form === 'new' ? null : form} doctors={doctors} onClose={() => setForm(null)} onSaved={saved} />}
      {detailId && !form && (
        <PatientDetail id={detailId} canWrite={canWrite} isAdmin={user.role === 'admin'}
          onClose={() => setDetailId(null)} onChanged={load}
          onEdit={(p) => { setDetailId(null); setForm(p); }} />
      )}
    </section>
  );
}