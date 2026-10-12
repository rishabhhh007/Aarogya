import { Router } from 'express';
import mongoose from 'mongoose';
import Duty from '../models/Duty.js';
import User from '../models/User.js';
import { Ward } from '../models/Hospital.js';
import { protect, authorize } from '../middleware/auth.js';

const r = Router();
r.use(protect, authorize('admin', 'doctor'));

const ok = (id) => mongoose.isValidObjectId(id);
r.param('id', (req, res, next, id) => (ok(id) ? next() : res.status(400).json({ message: 'Invalid id' })));

const SHIFTS = ['morning', 'evening', 'night'];
const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => fmt(new Date());
const addDays = (s, n) => { const d = new Date(`${s}T00:00:00`); d.setDate(d.getDate() + n); return fmt(d); };
const validDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
const populate = (q) => q.populate('doctor', 'name specialization').populate('ward', 'name type');

// Wards for the dropdowns (doctors cannot open the admin infrastructure routes)
r.get('/wards', async (_req, res) => res.json(await Ward.find().select('name type').sort('name')));

// List duties. A doctor only ever receives their own.
r.get('/', async (req, res) => {
  const { from, to, doctor } = req.query;
  const f = {};
  if (validDate(from) || validDate(to)) f.date = { ...(validDate(from) && { $gte: from }), ...(validDate(to) && { $lte: to }) };
  if (req.user.role === 'doctor') f.doctor = req.user._id;
  else if (ok(doctor)) f.doctor = doctor;
  res.json(await populate(Duty.find(f).limit(500)));
});

// Admin: assign a doctor to a ward and shift (optionally for several days in a row)
r.post('/', authorize('admin'), async (req, res) => {
  const { doctor, ward, date, shift } = req.body;
  const days = Math.min(Math.max(parseInt(req.body.days, 10) || 1, 1), 14);
  if (!ok(doctor) || !ok(ward)) return res.status(400).json({ message: 'Select a doctor and a ward' });
  if (!validDate(date) || !SHIFTS.includes(shift)) return res.status(400).json({ message: 'Pick a date and a shift' });
  if (date < todayStr()) return res.status(400).json({ message: 'Choose today or a future date' });
  if (!(await User.exists({ _id: doctor, role: 'doctor' })) || !(await Ward.exists({ _id: ward }))) return res.status(404).json({ message: 'Doctor or ward not found' });

  let created = 0, skipped = 0;
  for (let i = 0; i < days; i++) {
    try { await Duty.create({ doctor, ward, date: addDays(date, i), shift, createdBy: req.user._id }); created++; }
    catch (e) { if (e.code === 11000) skipped++; else throw e; }
  }
  if (!created) return res.status(409).json({ message: 'That doctor already has a duty in that shift' });
  res.status(201).json({ created, skipped });
});

// Doctor: take an extra shift (for example to attend a priority patient)
r.post('/extra', authorize('doctor'), async (req, res) => {
  const { ward, date, shift, reason, patientName } = req.body;
  if (!ok(ward) || !(await Ward.exists({ _id: ward }))) return res.status(400).json({ message: 'Select a ward' });
  if (!SHIFTS.includes(shift)) return res.status(400).json({ message: 'Pick a shift' });
  if (!validDate(date) || date < todayStr() || date > addDays(todayStr(), 7)) return res.status(400).json({ message: 'Extra shifts can be added for the next 7 days' });
  if (!reason || reason.trim().length < 3) return res.status(400).json({ message: 'Please give a reason' });
  const w = await Ward.findById(ward);
  try {
    const d = await Duty.create({
      doctor: req.user._id, ward, date, shift, createdBy: req.user._id,
      changes: [{ at: new Date(), toShift: shift, toWard: w.name, reason: `Extra shift: ${reason.trim().slice(0, 180)}`, patientName: String(patientName || '').slice(0, 80), by: req.user._id }],
    });
    res.status(201).json(await populate(Duty.findById(d._id)));
  } catch (e) {
    res.status(e.code === 11000 ? 409 : 500).json({ message: e.code === 11000 ? 'You already have a duty in that shift' : 'Could not add shift' });
  }
});

// Change the shift and/or ward of a duty (the doctor's own, or any for admin). Every change is logged.
r.put('/:id/change', async (req, res) => {
  const d = await Duty.findById(req.params.id).populate('ward', 'name');
  if (!d) return res.status(404).json({ message: 'Duty not found' });
  if (req.user.role === 'doctor' && String(d.doctor) !== String(req.user._id)) return res.status(403).json({ message: 'Forbidden' });
  if (d.date < todayStr()) return res.status(400).json({ message: 'Past duties cannot be changed' });

  const { shift, ward, reason, patientName } = req.body;
  const newShift = shift || d.shift;
  if (!SHIFTS.includes(newShift)) return res.status(400).json({ message: 'Invalid shift' });
  let newWard = d.ward;
  if (ward && String(ward) !== String(d.ward._id)) {
    if (!ok(ward) || !(newWard = await Ward.findById(ward))) return res.status(404).json({ message: 'Ward not found' });
  }
  if (newShift === d.shift && String(newWard._id) === String(d.ward._id)) return res.status(400).json({ message: 'Nothing was changed' });
  if (!reason || reason.trim().length < 3) return res.status(400).json({ message: 'Please give a reason' });

  d.changes.push({
    at: new Date(), fromShift: d.shift, toShift: newShift, fromWard: d.ward.name, toWard: newWard.name,
    reason: reason.trim().slice(0, 200), patientName: String(patientName || '').slice(0, 80), by: req.user._id,
  });
  d.shift = newShift;
  d.ward = newWard._id;
  try { await d.save(); }
  catch (e) { return res.status(e.code === 11000 ? 409 : 500).json({ message: e.code === 11000 ? 'The doctor already has a duty in that shift' : 'Could not save' }); }
  res.json(await populate(Duty.findById(d._id)));
});

r.delete('/:id', authorize('admin'), async (req, res) => {
  const d = await Duty.findByIdAndDelete(req.params.id);
  if (!d) return res.status(404).json({ message: 'Duty not found' });
  res.json({ message: 'Duty removed' });
});

export default r;