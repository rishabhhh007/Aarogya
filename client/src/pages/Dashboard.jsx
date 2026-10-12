import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { SHIFTS, toStr } from '../shifts';

// Number that counts up from 0 when it appears
function CountUp({ value }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (value == null) return;
    let start = null, id;
    const step = (t) => {
      if (!start) start = t;
      const p = Math.min((t - start) / 900, 1);
      setN(Math.round(value * p));
      if (p < 1) id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [value]);
  return value == null ? '—' : n;
}

function Stat({ title, icon, value, accent = 'indigo', i = 0, to, cta }) {
  return (
    <div className={`card accent-${accent}`} style={{ '--i': i }}>
      <h3><span className="icon">{icon}</span>{title}</h3>
      <p className="big"><CountUp value={value} /></p>
      {to && <Link className="btn" to={to}>{cta}</Link>}
    </div>
  );
}

const bedLabel = (b) => (b ? `${b.room?.ward?.name} · Room ${b.room?.number} · ${b.number}` : '—');

function RecentTable({ title, rows, showDoctor }) {
  return (
    <section className="card" style={{ '--i': 6 }}>
      <div className="toolbar" style={{ marginBottom: 4 }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <Link className="link" to="/patients">View all →</Link>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr><th>ID</th><th>Patient</th><th>Age / Gender</th>{showDoctor && <th>Doctor</th>}<th>Bed</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows?.map((p) => (
              <tr key={p._id}>
                <td className="muted">{p.patientId}</td>
                <td><b>{p.name}</b></td>
                <td>{p.age ?? '—'} / {p.gender || '—'}</td>
                {showDoctor && <td>{p.doctor?.name || '—'}</td>}
                <td>{bedLabel(p.bed)}</td>
                <td><span className={`tag ${p.status}`}>{p.status}</span></td>
              </tr>
            ))}
            {rows && !rows.length && <tr><td colSpan="6">No patients yet</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [duty, setDuty] = useState([]);
  const [appts, setAppts] = useState([]);

  useEffect(() => {
    const url = user.role === 'admin' ? '/dashboard/stats' : '/dashboard/my-stats';
    api.get(url).then((r) => setD(r.data));
    if (user.role === 'doctor') api.get('/duties', { params: { from: toStr(), to: toStr() } }).then((r) => setDuty(r.data));
    if (user.role === 'doctor') {
      const t = new Date();
      const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
      api.get('/appointments', { params: { date: today, status: 'scheduled' } }).then((r) => setAppts(r.data));
    }
  }, [user.role]);

  const occupancy = d?.beds ? Math.round((d.occupiedBeds / d.beds) * 100) : 0;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page">
      <h2 className="welcome">{greet}, {user.name} 👋</h2>

      {/* ================= ADMIN ================= */}
      {user.role === 'admin' && (
        <>
          <section className="row">
            <Stat i={0} accent="teal" icon="🩺" title="Doctors" value={d?.doctors} to="/admin/doctors/new" cta="+ Add Doctor" />
            <div className="card accent-indigo" style={{ '--i': 1 }}>
              <h3><span className="icon">🏨</span>Hospital Setup</h3>
              <div className="trio">
                <div><b><CountUp value={d?.wards} /></b><span>Wards</span></div>
                <div><b><CountUp value={d?.rooms} /></b><span>Rooms</span></div>
                <div><b><CountUp value={d?.beds} /></b><span>Beds</span></div>
              </div>
              <Link className="btn" to="/infrastructure">+ Add Ward / Room / Bed</Link>
            </div>
            <Stat i={2} accent="pink" icon="🧑‍💼" title="Receptionists" value={d?.receptionists} to="/admin/receptionists/new" cta="+ Add Receptionist" />
          </section>

          <section className="row">
            <div className="card accent-indigo" style={{ '--i': 3 }}>
              <h3><span className="icon">🛏️</span>Total Beds</h3>
              <p className="big"><CountUp value={d?.beds} /></p>
              <div className="bar"><div style={{ width: `${occupancy}%` }} /></div>
              <div className="bar-label">{occupancy}% occupied</div>
            </div>
            <Stat i={4} accent="green" icon="✅" title="Available" value={d?.availableBeds} />
            <Stat i={5} accent="red" icon="🚑" title="Occupied" value={d?.occupiedBeds} />
          </section>

          <RecentTable title="Recent patients" rows={d?.recent} showDoctor />
        </>
      )}

      {/* ================= RECEPTIONIST ================= */}
      {user.role === 'receptionist' && (
        <>
          <section className="row">
            <Stat i={0} icon="📝" title="Registered today" value={d?.today} />
            <Stat i={1} accent="amber" icon="⏳" title="Waiting for a bed" value={d?.waiting} />
            <Stat i={2} accent="green" icon="🛏️" title="Free beds" value={d?.freeBeds} />
            <Stat i={3} accent="red" icon="🏥" title="Admitted now" value={d?.admitted} />
          </section>

          <section className="card quick" style={{ '--i': 4 }}>
            <h3>Quick actions</h3>
            <div className="quick-row">
              <Link className="btn" to="/patients">+ Register patient</Link>
              <Link className="btn ghost-blue" to="/patients">Assign a bed</Link>
              <Link className="btn ghost-blue" to="/patients">Find a patient</Link>
            </div>
          </section>

          <RecentTable title="Latest registrations" rows={d?.recent} showDoctor />
        </>
      )}

      {/* ================= DOCTOR ================= */}
      {user.role === 'doctor' && (
        <>
          <section className="row">
            <Stat i={0} icon="🧑‍🤝‍🧑" title="My patients" value={d?.total} />
            <Stat i={1} accent="red" icon="🏥" title="Admitted" value={d?.admitted} />
            <Stat i={2} accent="amber" icon="🚶" title="Outpatients" value={d?.outpatients} />
          </section>

          <section className="card" style={{ '--i': 3 }}>
            <div className="toolbar" style={{ marginBottom: 6 }}>
              <h3 style={{ margin: 0 }}><span className="icon">📅</span>Today's schedule</h3>
              <Link className="link" to="/appointments">Open calendar →</Link>
            </div>
            {appts.length ? appts.map((a) => (
              <div key={a._id} className="sched">
                <b>{(() => { const [h, m] = a.time.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; })()}</b>
                <span>{a.patient?.name}</span>
                <span className="muted">{a.reason || 'Consultation'}</span>
              </div>
            )) : <p className="muted" style={{ margin: 0 }}>No appointments left today.</p>}
          </section>
                    <section className="card" style={{ '--i': 3 }}>
            <div className="toolbar" style={{ marginBottom: 6 }}>
              <h3 style={{ margin: 0 }}><span className="icon">🗓️</span>Today's ward duty</h3>
              <Link className="link" to="/duty">Full schedule →</Link>
            </div>
            {duty.length
              ? duty.map((x) => <p key={x._id} style={{ margin: '4px 0' }}>{SHIFTS[x.shift].icon} <b>{SHIFTS[x.shift].label}</b> ({SHIFTS[x.shift].time}) · {x.ward?.name}</p>)
              : <p className="muted" style={{ margin: 0 }}>No ward duty today.</p>}
          </section>
          <RecentTable title="My recent patients" rows={d?.recent} />
        </>
      )}
    </div>
  );
}