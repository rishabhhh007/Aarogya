import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';
import { SHIFTS, ORDER, pretty, toStr } from '../shifts';

// duties: the duties the doctor may move. Empty list means only "extra shift" is possible.
export default function ShiftModal({ duties = [], defaultWard = '', patientName = '', date = toStr(), onClose, onSaved }) {
  const [wards, setWards] = useState([]);
  const [mode, setMode] = useState(duties.length ? 'move' : 'extra');
  const [dutyId, setDutyId] = useState(duties[0]?._id || '');
  const duty = duties.find((d) => d._id === dutyId);
  const [shift, setShift] = useState(duty?.shift || 'morning');
  const [ward, setWard] = useState(defaultWard || duty?.ward?._id || '');
  const [reason, setReason] = useState(patientName ? `To attend priority patient ${patientName}` : '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get('/duties/wards').then((r) => setWards(r.data)); }, []);

  const pickDuty = (id) => {
    setDutyId(id);
    const d = duties.find((x) => x._id === id);
    if (d) { setShift(d.shift); if (!defaultWard) setWard(d.ward?._id); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      if (mode === 'move') await api.put(`/duties/${dutyId}/change`, { shift, ward, reason, patientName });
      else await api.post('/duties/extra', { shift, ward, date, reason, patientName });
      onSaved(mode === 'move' ? 'Duty updated' : 'Extra shift added');
    } catch (e) { setErr(e.response?.data?.message || 'Could not save'); setBusy(false); }
  };

  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>{patientName ? 'Attend priority patient' : 'Change my duty'}</h2><button className="x" onClick={onClose}>✕</button></div>
        <form className="form" onSubmit={submit}>
          {duties.length > 0 && (
            <div className="tabs" style={{ margin: 0 }}>
              <button type="button" className={`tab ${mode === 'move' ? 'on' : ''}`} onClick={() => setMode('move')}>Move my duty</button>
              <button type="button" className={`tab ${mode === 'extra' ? 'on' : ''}`} onClick={() => setMode('extra')}>Take an extra shift</button>
            </div>
          )}

          {mode === 'move' ? (
            <>
              {duties.length > 1 && (
                <>
                  <label>Which duty?</label>
                  <select value={dutyId} onChange={(e) => pickDuty(e.target.value)}>
                    {duties.map((d) => <option key={d._id} value={d._id}>{SHIFTS[d.shift].label} · {d.ward?.name}</option>)}
                  </select>
                </>
              )}
              {duty && <p className="muted" style={{ margin: 0 }}>Current: <b>{SHIFTS[duty.shift].label}</b> ({SHIFTS[duty.shift].time}) in <b>{duty.ward?.name}</b> on {pretty(duty.date)}</p>}
            </>
          ) : <p className="muted" style={{ margin: 0 }}>Adds an extra shift on {pretty(date)}. Your normal duty stays as it is.</p>}

          <label>{mode === 'move' ? 'New shift' : 'Shift'}</label>
          <div className="shift-opts">
            {ORDER.map((s) => (
              <button type="button" key={s} className={`shift-opt ${shift === s ? 'on' : ''}`} onClick={() => setShift(s)}>
                <span>{SHIFTS[s].icon}</span><b>{SHIFTS[s].label}</b><small>{SHIFTS[s].time}</small>
              </button>
            ))}
          </div>

          <label>Ward</label>
          <select value={ward} onChange={(e) => setWard(e.target.value)} required>
            <option value="">Select ward</option>
            {wards.map((w) => <option key={w._id} value={w._id}>{w.name} ({w.type})</option>)}
          </select>

          <label>Reason *</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you changing it?" required />

          {err && <p className="err" style={{ textAlign: 'left' }}>{err}</p>}
          <div className="actions">
            <button className="btn" disabled={busy}>{busy ? 'Saving...' : mode === 'move' ? 'Save change' : 'Add extra shift'}</button>
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>, document.body);
}