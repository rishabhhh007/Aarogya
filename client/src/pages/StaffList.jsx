import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

const LABEL = { doctors: 'Doctor', receptionists: 'Receptionist' };

export default function StaffList({ type }) {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setLoading(true);
    setQ('');
    api.get(`/staff/${type}`).then((r) => setRows(r.data)).finally(() => setLoading(false));
  }, [type]);

  const remove = async (u) => {
    if (!window.confirm(`Remove ${u.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/staff/${type}/${u._id}`);
      setRows(rows.filter((x) => x._id !== u._id));
    } catch (e) { setMsg(e.response?.data?.message || 'Could not remove'); }
  };

  const shown = rows.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <section className="card">
      <div className="toolbar">
        <input className="search" placeholder={`Search ${type}...`} value={q} onChange={(e) => setQ(e.target.value)} />
        <Link className="btn" to={`/admin/${type}/new`}>+ Add {LABEL[type]}</Link>
      </div>
      {msg && <p className="err" style={{ textAlign: 'left' }}>{msg}</p>}
      <table>
        <thead>
          <tr>
            <th>Name</th><th>Email</th><th>Phone</th>
            {type === 'doctors' && <th>Specialization</th>}
            <th>Joined</th><th></th>
          </tr>
        </thead>
        <tbody>
          {shown.map((u) => (
            <tr key={u._id}>
              <td><b>{u.name}</b></td>
              <td>{u.email}</td>
              <td>{u.phone || '—'}</td>
              {type === 'doctors' && <td><span className="tag outpatient">{u.specialization}</span></td>}
              <td>{new Date(u.createdAt).toLocaleDateString()}</td>
              <td><button className="btn danger" onClick={() => remove(u)}>Remove</button></td>
            </tr>
          ))}
          {!loading && !shown.length && (
            <tr><td colSpan="6">{rows.length ? 'No matches' : `No ${type} added yet`}</td></tr>
          )}
        </tbody>
      </table>
    </section>
  );
}