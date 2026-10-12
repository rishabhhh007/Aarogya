import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const FIELDS = [['temperature', 'Temperature (°C)', '0.1'], ['systolic', 'BP systolic', '1'], ['diastolic', 'BP diastolic', '1'],
  ['pulse', 'Pulse (bpm)', '1'], ['spo2', 'SpO2 (%)', '1'], ['respRate', 'Breathing (/min)', '1']];
const EMPTY = { temperature: '', systolic: '', diastolic: '', pulse: '', spo2: '', respRate: '', notes: '' };
const cls = (f) => (f ? `v-${f}` : '');

export default function CareModal({ patient, initialTab = 'vitals', onClose }) {
  const { user } = useAuth();
  const canLabs = user.role !== 'receptionist';
  const [tab, setTab] = useState(initialTab);
  const [vitals, setVitals] = useState([]);
  const [labs, setLabs] = useState([]);
  const [tests, setTests] = useState([]);
  const [f, setF] = useState(EMPTY);
  const [lab, setLab] = useState({ test: '', urgent: false });
  const [res, setRes] = useState({});   // lab id -> { result, abnormal }
  const [msg, setMsg] = useState(null);

  const loadVitals = () => api.get(`/vitals/patient/${patient._id}`).then((r) => setVitals(r.data));
  const loadLabs = () => api.get('/labs', { params: { patient: patient._id } }).then((r) => setLabs(r.data));
  useEffect(() => {
    loadVitals();
    if (canLabs) { loadLabs(); api.get('/labs/tests').then((r) => setTests(r.data)); }
  }, []);

  const say = (ok, text) => { setMsg({ ok, text }); setTimeout(() => setMsg(null), 3000); };
  const fail = (e) => say(false, e.response?.data?.message || 'Something went wrong');

  const saveVitals = async (e) => {
    e.preventDefault();
    try { await api.post('/vitals', { patient: patient._id, ...f }); setF(EMPTY); say(true, 'Vitals recorded'); loadVitals(); } catch (e) { fail(e); }
  };
  const requestLab = async (e) => {
    e.preventDefault();
    try { await api.post('/labs', { patient: patient._id, ...lab }); setLab({ test: '', urgent: false }); say(true, 'Lab test requested'); loadLabs(); } catch (e) { fail(e); }
  };
  const saveResult = async (id) => {
    try { await api.put(`/labs/${id}/result`, res[id] || {}); say(true, 'Result saved'); loadLabs(); } catch (e) { fail(e); }
  };

  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>{patient.name} <span className="muted">{patient.patientId}</span></h2><button className="x" onClick={onClose}>✕</button></div>
        <div className="tabs">
          <button className={`tab ${tab === 'vitals' ? 'on' : ''}`} onClick={() => setTab('vitals')}>Vitals</button>
          {canLabs && <button className={`tab ${tab === 'labs' ? 'on' : ''}`} onClick={() => setTab('labs')}>Lab tests</button>}
        </div>
        {msg && <p className={msg.ok ? 'ok' : 'err'} style={{ textAlign: 'left' }}>{msg.text}</p>}

        {tab === 'vitals' && (
          <>
            <form className="form" onSubmit={saveVitals}>
              <div className="grid2">
                {FIELDS.map(([k, label, step]) => (
                  <div key={k}><label>{label}</label>
                    <input type="number" step={step} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
                ))}
              </div>
              <label>Notes (optional)</label>
              <input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
              <div className="actions"><button className="btn">Record vitals</button></div>
            </form>

            <p className="section-title">History (abnormal values are highlighted)</p>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr><th>Time</th><th>Temp</th><th>BP</th><th>Pulse</th><th>SpO2</th><th>Breathing</th><th>By</th></tr></thead>
                <tbody>
                  {vitals.map((v) => (
                    <tr key={v._id}>
                      <td>{new Date(v.createdAt).toLocaleString()}</td>
                      <td className={cls(v.flags.temperature)}>{v.temperature ?? '—'}</td>
                      <td className={cls(v.flags.bp)}>{v.systolic != null ? `${v.systolic}/${v.diastolic}` : '—'}</td>
                      <td className={cls(v.flags.pulse)}>{v.pulse ?? '—'}</td>
                      <td className={cls(v.flags.spo2)}>{v.spo2 ?? '—'}</td>
                      <td className={cls(v.flags.respRate)}>{v.respRate ?? '—'}</td>
                      <td>{v.recordedBy?.name || '—'}</td>
                    </tr>
                  ))}
                  {!vitals.length && <tr><td colSpan="7">No vitals recorded yet</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'labs' && canLabs && (
          <>
            <form className="assign" onSubmit={requestLab}>
              <label>Request a test</label>
              <div className="assign-row">
                <select value={lab.test} onChange={(e) => setLab({ ...lab, test: e.target.value })} required>
                  <option value="">Select test</option>
                  {tests.map((t) => <option key={t}>{t}</option>)}
                </select>
                <label className="check"><input type="checkbox" checked={lab.urgent} onChange={(e) => setLab({ ...lab, urgent: e.target.checked })} /> Urgent</label>
                <button className="btn">Request</button>
              </div>
            </form>

            {labs.map((l) => (
              <div className="hist" key={l._id}>
                <b>{l.test}</b> {l.urgent && l.status === 'requested' && <span className="tag cancelled">urgent</span>}{' '}
                <span className={`tag ${l.status === 'completed' ? 'completed' : 'scheduled'}`}>{l.status}</span>
                <span className="muted"> · requested {new Date(l.createdAt).toLocaleDateString()}{l.requestedBy ? ` by ${l.requestedBy.name}` : ''}</span>
                {l.status === 'completed' ? (
                  <div style={{ marginTop: 4 }}>Result: {l.result} {l.abnormal && <span className="tag cancelled">abnormal</span>}</div>
                ) : (
                  <div className="assign-row" style={{ marginTop: 8 }}>
                    <input placeholder="Enter result" value={res[l._id]?.result || ''} onChange={(e) => setRes({ ...res, [l._id]: { ...res[l._id], result: e.target.value } })} />
                    <label className="check"><input type="checkbox" checked={!!res[l._id]?.abnormal} onChange={(e) => setRes({ ...res, [l._id]: { ...res[l._id], abnormal: e.target.checked } })} /> Abnormal</label>
                    <button type="button" className="btn small" onClick={() => saveResult(l._id)}>Save result</button>
                  </div>
                )}
              </div>
            ))}
            {!labs.length && <p className="muted">No lab tests for this patient yet.</p>}
          </>
        )}
        <div className="actions"><button className="btn ghost" onClick={onClose}>Close</button></div>
      </div>
    </div>, document.body);
}