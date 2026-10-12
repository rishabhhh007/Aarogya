import { useEffect, useState } from 'react';
import api from '../api';
import CareModal from '../components/CareModal';

export default function Labs() {
  const [tab, setTab] = useState('requested');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);

  const load = () => api.get('/labs', { params: { status: tab } }).then((r) => setRows(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, [tab]);

  return (
    <section className="card">
      <div className="tabs">
        <button className={`tab ${tab === 'requested' ? 'on' : ''}`} onClick={() => setTab('requested')}>Pending results</button>
        <button className={`tab ${tab === 'completed' ? 'on' : ''}`} onClick={() => setTab('completed')}>Completed</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Patient</th><th>Test</th><th>Requested</th><th>Result</th><th></th></tr></thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l._id}>
                <td><b>{l.patient?.name}</b> <span className="muted">{l.patient?.patientId}</span></td>
                <td>{l.test} {l.urgent && l.status === 'requested' && <span className="tag cancelled">urgent</span>}</td>
                <td>{new Date(l.createdAt).toLocaleDateString()}{l.requestedBy ? ` · ${l.requestedBy.name}` : ''}</td>
                <td>{l.status === 'completed' ? <>{l.result} {l.abnormal && <span className="tag cancelled">abnormal</span>}</> : '—'}</td>
                <td><button className="btn small ghost-blue" onClick={() => l.patient && setOpen(l.patient)}>{l.status === 'requested' ? 'Enter result' : 'Open'}</button></td>
              </tr>
            ))}
            {!loading && !rows.length && <tr><td colSpan="5">{tab === 'requested' ? 'No pending lab tests' : 'No completed lab tests'}</td></tr>}
          </tbody>
        </table>
      </div>
      {open && <CareModal patient={open} initialTab="labs" onClose={() => { setOpen(null); load(); }} />}
    </section>
  );
}