import { Router } from 'express';
import mongoose from 'mongoose';
import Appointment from '../models/Appointment.js';
import { Patient } from '../models/Hospital.js';
import User from '../models/User.js';
import { protect, authorize } from '../middleware/auth.js';

const r = Router();
r.use(protect, authorize('admin', 'receptionist', 'doctor'));
const staff = authorize('admin', 'receptionist'); // booking and rescheduling

const ok = (id) => mongoose.isValidObjectId(id);
r.param('id', (req, res, next, id) => (ok(id) ? next() : res.status(400).json({ message: 'Invalid id' })));

// Working hours: 09:00-17:00 every 30 minutes, with a lunch break 13:00-14:00 (edit freely)
const pad = (n) => String(n).padStart(2, '0');
const SLOTS = [];
for (let h = 9; h < 17; h++) for (const m of ['00', '30']) if (h !== 13) SLOTS.push(`${pad(h)}:${m}`);

const validDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
const isPast = (date, time) => {
  const n = new Date();
  const today = `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
  const now = `${pad(n.getHours())}:${pad(n.getMinutes())}`;
  return date < today || (date === today && time <= now);
};
const populate = (q) => q.populate('patient', 'name patientId phone age gender').populate('doctor', 'name specialization');

// Free / taken slots for one doctor on one date
r.get('/slots', async (req, res) => {
  const { doctor, date } = req.query;
  if (!ok(doctor) || !validDate(date)) return res.status(400).json({ message: 'Doctor and date are required' });
  const taken = new Set((await Appointment.find({ doctor, date, status: 'scheduled' }).select('time')).map((a) => a.time));
  res.json(SLOTS.map((time) => ({ time, available: !taken.has(time) && !isPast(date, time) })));
});

// List (a doctor only ever gets their own appointments)
r.get('/', async (req, res) => {
  const { date, doctor, status } = req.query;
  const f = {};
  if (validDate(date)) f.date = date;
  if (req.user.role === 'doctor') f.doctor = req.user._id;
  else if (ok(doctor)) f.doctor = doctor;
  if (['scheduled', 'completed', 'cancelled'].includes(status)) f.status = status;
  res.json(await populate(Appointment.find(f).sort('date time')));
});

// Book
r.post('/', staff, async (req, res) => {
  const { patient, doctor, date, time, reason } = req.body;
  if (!ok(patient) || !ok(doctor)) return res.status(400).json({ message: 'Select a patient and a doctor' });
  if (!validDate(date) || !SLOTS.includes(time)) return res.status(400).json({ message: 'Pick a date and a time slot' });
  if (isPast(date, time)) return res.status(400).json({ message: 'That time has already passed' });

  const [p, d] = await Promise.all([Patient.findById(patient), User.findOne({ _id: doctor, role: 'doctor' })]);
  if (!p || !d) return res.status(404).json({ message: 'Patient or doctor not found' });

  try {
    const a = await Appointment.create({ patient, doctor, date, time, reason: reason?.trim(), createdBy: req.user._id });
    res.status(201).json(a);
  } catch (e) {
    res.status(e.code === 11000 ? 409 : 500).json({ message: e.code === 11000 ? 'That slot was just taken, pick another' : 'Could not book' });
  }
});

// Reschedule
r.put('/:id/reschedule', staff, async (req, res) => {
  const { date, time } = req.body;
  const a = await Appointment.findById(req.params.id);
  if (!a) return res.status(404).json({ message: 'Appointment not found' });
  if (a.status !== 'scheduled') return res.status(400).json({ message: `This appointment is ${a.status}` });
  if (!validDate(date) || !SLOTS.includes(time)) return res.status(400).json({ message: 'Pick a date and a time slot' });
  if (isPast(date, time)) return res.status(400).json({ message: 'That time has already passed' });
  a.date = date; a.time = time;
  try { await a.save(); res.json(a); }
  catch (e) { res.status(e.code === 11000 ? 409 : 500).json({ message: e.code === 11000 ? 'That slot is taken, pick another' : 'Could not reschedule' }); }
});

// Cancel (admin/receptionist) or mark completed (the doctor's own appointment, or admin/receptionist)
r.put('/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['completed', 'cancelled'].includes(status)) return res.status(400).json({ message: 'Invalid status' });
  const a = await Appointment.findById(req.params.id);
  if (!a) return res.status(404).json({ message: 'Appointment not found' });
  if (req.user.role === 'doctor' && (String(a.doctor) !== String(req.user._id) || status !== 'completed'))
    return res.status(403).json({ message: 'Forbidden' });
  if (a.status !== 'scheduled') return res.status(400).json({ message: `This appointment is already ${a.status}` });
  a.status = status;
  await a.save();
  res.json(a);
});

export default r;