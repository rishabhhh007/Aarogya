import { useEffect, useState } from 'react';
import api from '../api';

const TYPES = ['General', 'ICU', 'Emergency', 'Maternity', 'Pediatric', 'Surgical'];

function Room({ room, run }) {
  const [count, setCount] = useState(1);
  const free = room.beds.filter((b) => b.status === 'available').length;

  return (
    <div className="room">
      <div className="room-head">
        <b>Room {room.number}</b>
        <span className="muted">{free}/{room.beds.length} beds free</span>
        <button className="x" title="Delete room" onClick={() => window.confirm(`Delete room ${room.number} and all its beds?`) && run(() => api.delete(`/infra/rooms/${room._id}`), 'Room removed')}>🗑</button>
      </div>

      <div className="beds">
        {room.beds.map((b) => (
          <span key={b._id} className={`bed ${b.status}`} title={b.patient ? `Patient: ${b.patient}` : b.status}>
            {b.number}
            {b.status === 'available' && (
              <button onClick={() => run(() => api.delete(`/infra/beds/${b._id}`), 'Bed removed')}>×</button>
            )}
          </span>
        ))}
        {!room.beds.length && <span className="muted">No beds yet</span>}
      </div>

      <form className="inline" onSubmit={(e) => { e.preventDefault(); run(() => api.post(`/infra/rooms/${room._id}/beds`, { count }), `${count} bed(s) added`); }}>
        <input type="number" min="1" max="20" value={count} onChange={(e) => setCount(e.target.value)} />
        <button className="btn small">+ Add beds</button>
      </form>
    </div>
  );
}

function Ward({ ward, run }) {
  const [num, setNum] = useState('');
  const total = ward.rooms.reduce((s, r) => s + r.beds.length, 0);
  const free = ward.rooms.reduce((s, r) => s + r.beds.filter((b) => b.status === 'available').length, 0);

  const addRoom = async (e) => {
    e.preventDefault();
    if (await run(() => api.post(`/infra/wards/${ward._id}/rooms`, { number: num }), `Room ${num} added`)) setNum('');
  };

  return (
    <div className="card ward">
      <div className="ward-head">
        <div>
          <h3 style={{ margin: 0, color: 'var(--text)', fontSize: 17, textTransform: 'none', letterSpacing: 0 }}>{ward.name}</h3>
          <span className="tag outpatient">{ward.type}</span>
          <span className="muted"> {ward.rooms.length} rooms · {free}/{total} beds free</span>
        </div>
        <button className="btn danger" onClick={() => window.confirm(`Delete ward "${ward.name}" with all its rooms and beds?`) && run(() => api.delete(`/infra/wards/${ward._id}`), 'Ward removed')}>Delete ward</button>
      </div>

      <div className="rooms">
        {ward.rooms.map((rm) => <Room key={rm._id} room={rm} run={run} />)}
        {!ward.rooms.length && <p className="muted">No rooms yet. Add the first one below.</p>}
      </div>

      <form className="inline" onSubmit={addRoom}>
        <input placeholder="Room number (e.g. 101)" value={num} onChange={(e) => setNum(e.target.value)} required />
        <button className="btn small">+ Add room</button>
      </form>
    </div>
  );
}

export default function Infrastructure() {
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [f, setF] = useState({ name: '', type: 'General' });

  const load = () => api.get('/infra/tree').then((r) => setWards(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  // runs an API call, shows a message, refreshes the tree; returns true on success
  const run = async (fn, okText) => {
    try { await fn(); setMsg({ ok: true, text: okText }); await load(); return true; }
    catch (e) { setMsg({ ok: false, text: e.response?.data?.message || 'Something went wrong' }); return false; }
  };

  const addWard = async (e) => {
    e.preventDefault();
    if (await run(() => api.post('/infra/wards', f), `Ward "${f.name}" added`)) setF({ ...f, name: '' });
  };

  const rooms = wards.reduce((s, w) => s + w.rooms.length, 0);
  const beds = wards.reduce((s, w) => s + w.rooms.reduce((x, r) => x + r.beds.length, 0), 0);

  return (
    <div>
      <div className="summary">
        <div><b>{wards.length}</b><span>Wards</span></div>
        <div><b>{rooms}</b><span>Rooms</span></div>
        <div><b>{beds}</b><span>Beds</span></div>
      </div>

      <form className="card inline-card" onSubmit={addWard}>
        <input placeholder="New ward name (e.g. General Ward A)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
          {TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <button className="btn">+ Add ward</button>
      </form>

      {msg && <p className={msg.ok ? 'ok' : 'err'} style={{ textAlign: 'left' }}>{msg.text}</p>}

      <div className="wards">
        {wards.map((w) => <Ward key={w._id} ward={w} run={run} />)}
        {!loading && !wards.length && <div className="card" style={{ textAlign: 'center' }}>No wards yet. Add your first ward above, then add rooms, then beds.</div>}
      </div>

      <div className="legend"><span className="bed available">Available</span><span className="bed occupied">Occupied</span></div>
    </div>
  );
}