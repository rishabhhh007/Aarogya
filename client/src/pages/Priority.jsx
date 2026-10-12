import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import CareModal from '../components/CareModal';
import ShiftModal from '../components/ShiftModal';
import { SHIFTS, toStr, sortDuties } from '../shifts';

const LEVELS = { critical: 'Critical', high: 'High', medium: 'Medium', stable: 'Stable' };
const cls = (f) => (f ? `v-${f}` : '');

export default function Priority() {
  const { user } = useAuth();
  const isDoctor = user.role === 'doctor';
  const [list, setList] = useState([]);
  const [duties, setDuties] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [care, setCare] = useState(null);
  const [attend, setAttend] = useState(null);
  const [toast, setToast] = useState('');
  const today = toStr();

  const load = () => {
    api.get('/vitals/priority').then((r) => setList(r.data)).finally(() => setLoading(false));
    if (isDoctor) api.get('/duties', { params: { from: today, to: today } }).then((r) => setDuties(r.data.sort(sortDuties)));
  };
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);

  const shown = filter === 'all' ? list : list.filter((p) => p.level === filter);
  const count = (l) => list.filter((p) => p.level === l).length;

  return (
    <div>
      {isDoctor && (
        <div className="card" style={{ marginBottom: 14 }}>
          <b>Your duty today: </b>
          {duties.length ? duties.map((d) => `${SHIFTS[d.shift].label} (${SHIFTS[d.shift].time}) · ${d.ward?.name}`).join('  |  ') : 'none assigned'}
        </div>
      )}
      {toast && <p className="ok">{toast}</p>}

      <div className="tabs">
        {['all', 'critical', 'high', 'medium', 'stable'].map((l) => (
          <button key={l} className={`tab ${filter === l ? 'on' : ''}`} onClick={() => setFilter(l)}>
            {l === 'all' ? `All (${list.length})` : `${LEVELS[l]} (${count(l)})`}
          </button>
        ))}
      </div>
      <p className="muted" style={{ margin: '0 0 12px' }}>Ranked automatically from vitals, age, ward and urgent lab tests. This is decision support only. The doctor's judgement always comes first. Refreshes every minute.</p>

      <div className="prio-list">
        {shown.map((p) => (
          <div className={`card prio ${p.level}`} key={p._id}>
            <div className="prio-head">
              <div>
                <b style={{ fontSize: 16 }}>{p.name}</b> <span className="muted">{p.patientId} · {p.age ?? '—'} / {p.gender || '—'}</span>
                <div className="muted">📍 {p.place}</div>
              </div>
              <div className="prio-score"><span className={`lvl ${p.level}`}>{LEVELS[p.level]}</span><small>score {p.score}</small></div>
            </div>
            <div className="chips">{p.reasons.length ? p.reasons.map((r) => <span key={r} className="chip">{r}</span>) : <span className="chip">No concerns found</span>}</div>
            {p.vitals && (
              <div className="vrow">
                <span className={cls(p.flags.temperature)}>🌡 {p.vitals.temperature ?? '—'}</span>
                <span className={cls(p.flags.bp)}>🩸 {p.vitals.systolic != null ? `${p.vitals.systolic}/${p.vitals.diastolic}` : '—'}</span>
                <span className={cls(p.flags.pulse)}>💓 {p.vitals.pulse ?? '—'}</span>
                <span className={cls(p.flags.spo2)}>🫁 {p.vitals.spo2 ?? '—'}%</span>
                <span className="muted">{new Date(p.vitals.createdAt).toLocaleString()}</span>
              </div>
            )}
            <div className="actions" style={{ marginTop: 10 }}>
              <button className="btn ghost-blue small" onClick={() => setCare(p)}>Vitals & labs</button>
              {isDoctor && p.ward && <button className="btn small" onClick={() => setAttend(p)}>Attend (adjust my duty)</button>}
            </div>
          </div>
        ))}
        {!loading && !shown.length && <div className="card">No admitted patients in this category.</div>}
      </div>

      {care && <CareModal patient={care} onClose={() => { setCare(null); load(); }} />}
      {attend && (
        <ShiftModal duties={duties} defaultWard={attend.ward?._id} patientName={attend.name} date={today}
          onClose={() => setAttend(null)} onSaved={(t) => { setAttend(null); setToast(`${t} for ${attend.name}`); load(); setTimeout(() => setToast(''), 4000); }} />
      )}
    </div>
  );
}