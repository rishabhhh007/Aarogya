import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';
import { printInvoice } from '../print';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const TABS = ['all', 'pending', 'partial', 'paid'];
const METHODS = ['cash', 'upi', 'card'];
const BLANK = { description: '', qty: 1, price: '' };

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

/* ---------- Create a bill ---------- */
function NewBill({ onClose, onSaved }) {
  const [patients, setPatients] = useState([]);
  const [patient, setPatient] = useState('');
  const [items, setItems] = useState([{ ...BLANK }]);
  const [discount, setDiscount] = useState('');
  const [pay, setPay] = useState({ amount: '', method: 'cash' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/patients').then((r) => setPatients(r.data)); }, []);

  const setRow = (i, k, v) => setItems(items.map((r, n) => (n === i ? { ...r, [k]: v } : r)));
  const subtotal = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0), 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0));

  const autofill = async () => {
    if (!patient) return setErr('Select a patient first');
    try {
      const { data } = await api.get(`/billing/suggest/${patient}`);
      if (!data.length) return setErr('Nothing to suggest for this patient. Add items manually.');
      setItems(data); setErr('');
    } catch { setErr('Could not load charges'); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!patient) return setErr('Select a patient');
    setErr(''); setBusy(true);
    try { await api.post('/billing', { patient, items, discount, payment: pay.amount ? pay : undefined }); onSaved('Bill created'); }
    catch (e) { setErr(e.response?.data?.message || 'Could not create bill'); setBusy(false); }
  };

  return (
    <Modal title="New bill" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>Patient *</label>
        <div className="assign-row">
          <select value={patient} onChange={(e) => setPatient(e.target.value)} required>
            <option value="">Select patient</option>
            {patients.map((p) => <option key={p._id} value={p._id}>{p.name} ({p.patientId})</option>)}
          </select>
          <button type="button" className="btn ghost-blue" onClick={autofill}>Auto-fill charges</button>
        </div>

        <p className="section-title">Items</p>
        {items.map((r, i) => (
          <div className="bill-row" key={i}>
            <input placeholder="Description" value={r.description} onChange={(e) => setRow(i, 'description', e.target.value)} />
            <input type="number" min="1" placeholder="Qty" value={r.qty} onChange={(e) => setRow(i, 'qty', e.target.value)} />
            <input type="number" min="0" placeholder="Price" value={r.price} onChange={(e) => setRow(i, 'price', e.target.value)} />
            <b className="line">{inr((Number(r.qty) || 0) * (Number(r.price) || 0))}</b>
            <button type="button" className="x" onClick={() => setItems(items.length > 1 ? items.filter((_, n) => n !== i) : [{ ...BLANK }])}>🗑</button>
          </div>
        ))}
        <button type="button" className="btn ghost-blue small" style={{ alignSelf: 'flex-start' }} onClick={() => setItems([...items, { ...BLANK }])}>+ Add item</button>

        <div className="grid2" style={{ marginTop: 12 }}>
          <div><label>Discount (₹)</label><input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
          <div><label>Payment received now (₹)</label><input type="number" min="0" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></div>
          <div><label>Payment method</label>
            <select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
              {METHODS.map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
            </select></div>
        </div>

        <div className="totals">
          <span>Subtotal {inr(subtotal)}</span>
          <span>Discount − {inr(discount)}</span>
          <b>Total {inr(total)}</b>
        </div>
        {err && <p className="err" style={{ textAlign: 'left' }}>{err}</p>}
        <div className="actions">
          <button className="btn" disabled={busy}>{busy ? 'Saving...' : 'Create bill'}</button>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- Bill details + take payment ---------- */
function BillDetail({ id, onClose, onChanged }) {
  const [b, setB] = useState(null);
  const [pay, setPay] = useState({ amount: '', method: 'cash' });
  const [msg, setMsg] = useState(null);
  const load = () => api.get(`/billing/${id}`).then((r) => setB(r.data));
  useEffect(() => { load(); }, [id]);

  const addPayment = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/billing/${id}/payment`, pay);
      setPay({ amount: '', method: 'cash' }); setMsg({ ok: true, text: 'Payment recorded' });
      await load(); onChanged();
    } catch (e) { setMsg({ ok: false, text: e.response?.data?.message || 'Could not record payment' }); }
  };

  if (!b) return <Modal title="Loading..." onClose={onClose}><p className="muted">Please wait</p></Modal>;
  const balance = b.total - b.paid;

  return (
    <Modal title={`${b.billNo} · ${b.patient?.name}`} onClose={onClose}>
      <p style={{ margin: '-6px 0 10px' }}><span className="muted">{b.patient?.patientId} · {new Date(b.createdAt).toLocaleDateString()} </span><span className={`tag ${b.status}`}>{b.status}</span></p>
      <table>
        <thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
        <tbody>
          {b.items.map((i, n) => <tr key={n}><td>{i.description}</td><td>{i.qty}</td><td>{inr(i.price)}</td><td>{inr(i.qty * i.price)}</td></tr>)}
        </tbody>
      </table>
      <div className="totals">
        {b.discount > 0 && <span>Discount − {inr(b.discount)}</span>}
        <span>Total <b>{inr(b.total)}</b></span>
        <span>Paid <b style={{ color: 'var(--green)' }}>{inr(b.paid)}</b></span>
        <span>Balance <b style={{ color: balance > 0 ? 'var(--red)' : 'var(--green)' }}>{inr(balance)}</b></span>
      </div>

      {b.payments.length > 0 && (
        <>
          <p className="section-title">Payments</p>
          {b.payments.map((p, n) => (
            <div className="hist" key={n}>{new Date(p.date).toLocaleString()} · <b>{inr(p.amount)}</b> · {p.method.toUpperCase()}{p.receivedBy ? ` · by ${p.receivedBy.name}` : ''}</div>
          ))}
        </>
      )}

      {balance > 0 && (
        <form className="assign" onSubmit={addPayment}>
          <label>Record a payment (balance {inr(balance)})</label>
          <div className="assign-row">
            <input type="number" min="1" max={balance} placeholder="Amount" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} required />
            <select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
              {METHODS.map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
            </select>
            <button className="btn">Add</button>
          </div>
        </form>
      )}
      {msg && <p className={msg.ok ? 'ok' : 'err'} style={{ textAlign: 'left' }}>{msg.text}</p>}
      <div className="actions">
        <button className="btn" onClick={() => printInvoice(b)}>🖨 Print invoice</button>
        <button className="btn ghost" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

/* ---------- Page ---------- */
export default function Billing() {
  const [rows, setRows] = useState([]);
  const [sum, setSum] = useState({ billed: 0, collected: 0, pending: 0 });
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [toast, setToast] = useState('');

  const load = () =>
    api.get('/billing', { params: { q, status: tab === 'all' ? '' : tab } })
      .then((r) => { setRows(r.data.bills); setSum(r.data.summary); }).finally(() => setLoading(false));
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q, tab]);

  const saved = (text) => { setCreating(false); setToast(text); load(); setTimeout(() => setToast(''), 3000); };

  return (
    <div>
      <div className="summary">
        <div><b>{inr(sum.billed)}</b><span>Total billed</span></div>
        <div><b style={{ color: 'var(--green)' }}>{inr(sum.collected)}</b><span>Collected</span></div>
        <div><b style={{ color: 'var(--red)' }}>{inr(sum.pending)}</b><span>Pending</span></div>
      </div>

      <section className="card">
        <div className="toolbar">
          <input className="search" placeholder="Search by patient, ID or bill no..." value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn" onClick={() => setCreating(true)}>+ New bill</button>
        </div>
        <div className="tabs">
          {TABS.map((t) => <button key={t} className={`tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
        </div>
        {toast && <p className="ok">{toast}</p>}
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Bill</th><th>Patient</th><th>Date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b._id}>
                  <td><button className="link" onClick={() => setOpenId(b._id)}>{b.billNo}</button></td>
                  <td>{b.patient?.name} <span className="muted">{b.patient?.patientId}</span></td>
                  <td>{new Date(b.createdAt).toLocaleDateString()}</td>
                  <td>{inr(b.total)}</td>
                  <td>{inr(b.paid)}</td>
                  <td><b>{inr(b.total - b.paid)}</b></td>
                  <td><span className={`tag ${b.status}`}>{b.status}</span></td>
                </tr>
              ))}
              {!loading && !rows.length && <tr><td colSpan="7">{q || tab !== 'all' ? 'No bills match' : 'No bills yet'}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {creating && <NewBill onClose={() => setCreating(false)} onSaved={saved} />}
      {openId && <BillDetail id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}