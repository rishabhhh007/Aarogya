import { Router } from 'express';
import mongoose from 'mongoose';
import Bill from '../models/Bill.js';
import Appointment from '../models/Appointment.js';
import { Patient } from '../models/Hospital.js';
import { protect, authorize } from '../middleware/auth.js';

const r = Router();
r.use(protect, authorize('admin', 'receptionist'));

const ok = (id) => mongoose.isValidObjectId(id);
r.param('id', (req, res, next, id) => (ok(id) ? next() : res.status(400).json({ message: 'Invalid id' })));

// Default prices used for the "auto-fill" suggestion (edit freely)
const CONSULT_FEE = 500;
const BED_RATE = { General: 1000, ICU: 5000, Emergency: 2500, Maternity: 2000, Pediatric: 1500, Surgical: 3000 };

const num = (v) => (v === '' || v == null ? NaN : Number(v));
const round2 = (n) => Math.round(n * 100) / 100;
const statusOf = (total, paid) => (paid <= 0 ? 'pending' : paid >= total ? 'paid' : 'partial');
const METHODS = ['cash', 'upi', 'card'];

async function nextBillNo() {
  const last = await Bill.findOne({ billNo: { $exists: true } }).sort('-createdAt').select('billNo');
  const n = last ? parseInt(last.billNo.replace(/\D/g, ''), 10) + 1 : 1;
  return `B-${String(n).padStart(4, '0')}`;
}

// Suggested line items for a patient (the receptionist can edit them)
r.get('/suggest/:patientId', async (req, res) => {
  if (!ok(req.params.patientId)) return res.status(400).json({ message: 'Invalid id' });
  const p = await Patient.findById(req.params.patientId)
    .populate({ path: 'bed', populate: { path: 'room', populate: { path: 'ward' } } });
  if (!p) return res.status(404).json({ message: 'Patient not found' });

  const items = [];
  const visits = await Appointment.countDocuments({ patient: p._id, status: 'completed' });
  if (visits) items.push({ description: `Consultation fee (${visits} visit${visits > 1 ? 's' : ''})`, qty: visits, price: CONSULT_FEE });
  if (p.admittedAt) {
    const days = Math.max(1, Math.ceil(((p.dischargedAt || new Date()) - p.admittedAt) / 86400000));
    const type = p.bed?.room?.ward?.type || 'General';
    items.push({ description: `Bed charges, ${type} ward (${days} day${days > 1 ? 's' : ''})`, qty: days, price: BED_RATE[type] ?? 1000 });
  }
  res.json(items);
});

// List with search + status filter + overall totals
r.get('/', async (req, res) => {
  const { q, status } = req.query;
  const f = {};
  if (['pending', 'partial', 'paid'].includes(status)) f.status = status;
  if (q?.trim()) {
    const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const ids = (await Patient.find({ $or: [{ name: rx }, { patientId: rx }] }).select('_id')).map((p) => p._id);
    f.$or = [{ patient: { $in: ids } }, { billNo: rx }];
  }
  const [bills, sum] = await Promise.all([
    Bill.find(f).populate('patient', 'name patientId phone').sort('-createdAt'),
    Bill.aggregate([{ $group: { _id: null, billed: { $sum: '$total' }, collected: { $sum: '$paid' } } }]),
  ]);
  const s = sum[0] || { billed: 0, collected: 0 };
  res.json({ bills, summary: { billed: s.billed, collected: s.collected, pending: s.billed - s.collected } });
});

r.get('/:id', async (req, res) => {
  const b = await Bill.findById(req.params.id)
    .populate('patient', 'name patientId phone age gender address')
    .populate('payments.receivedBy', 'name');
  if (!b) return res.status(404).json({ message: 'Bill not found' });
  res.json(b);
});

// Create (the total is always recalculated here, the browser's total is ignored)
r.post('/', async (req, res) => {
  const { patient, items, discount, payment } = req.body;
  if (!ok(patient) || !(await Patient.exists({ _id: patient }))) return res.status(400).json({ message: 'Select a patient' });

  const clean = (Array.isArray(items) ? items : [])
    .map((i) => ({ description: String(i.description || '').trim().slice(0, 120), qty: num(i.qty), price: num(i.price) }))
    .filter((i) => i.description);
  if (!clean.length) return res.status(400).json({ message: 'Add at least one item' });
  if (clean.some((i) => !(i.qty > 0) || !(i.price >= 0))) return res.status(400).json({ message: 'Check the quantity and price of each item' });

  const subtotal = round2(clean.reduce((s, i) => s + i.qty * i.price, 0));
  const disc = num(discount) || 0;
  if (disc < 0 || disc > subtotal) return res.status(400).json({ message: 'Discount cannot be more than the subtotal' });
  const total = round2(subtotal - disc);
  if (total <= 0) return res.status(400).json({ message: 'Bill total must be more than 0' });

  const bill = new Bill({ billNo: await nextBillNo(), patient, items: clean, discount: disc, total, createdBy: req.user._id });
  const amt = num(payment?.amount);
  if (amt > 0) {
    if (amt > total) return res.status(400).json({ message: 'Payment is more than the bill total' });
    bill.payments.push({ amount: round2(amt), method: METHODS.includes(payment.method) ? payment.method : 'cash', receivedBy: req.user._id });
    bill.paid = round2(amt);
  }
  bill.status = statusOf(total, bill.paid);
  await bill.save();
  res.status(201).json(bill);
});

// Record a payment
r.post('/:id/payment', async (req, res) => {
  const b = await Bill.findById(req.params.id);
  if (!b) return res.status(404).json({ message: 'Bill not found' });
  const amt = round2(num(req.body.amount));
  const balance = round2(b.total - b.paid);
  if (!(amt > 0)) return res.status(400).json({ message: 'Enter a payment amount' });
  if (amt > balance) return res.status(400).json({ message: `Only ₹${balance} is pending on this bill` });
  b.payments.push({ amount: amt, method: METHODS.includes(req.body.method) ? req.body.method : 'cash', receivedBy: req.user._id });
  b.paid = round2(b.paid + amt);
  b.status = statusOf(b.total, b.paid);
  await b.save();
  res.json(b);
});

export default r;