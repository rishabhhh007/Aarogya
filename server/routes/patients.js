import { Router } from 'express';
import mongoose from 'mongoose';
import { Patient, Bed } from '../models/Hospital.js';
import User from '../models/User.js';
import { protect, authorize } from '../middleware/auth.js';

const r = Router();
r.use(protect, authorize('admin', 'receptionist', 'doctor'));
const canWrite = authorize('admin', 'receptionist'); // doctors can view only

const ok = (id) => mongoose.isValidObjectId(id);
r.param('id', (req, res, next, id) => (ok(id) ? next() : res.status(400).json({ message: 'Invalid id' })));

const bedPopulate = { path: 'bed', select: 'number room', populate: { path: 'room', select: 'number ward', populate: { path: 'ward', select: 'name' } } };
const FIELDS = ['name', 'age', 'gender', 'phone', 'address', 'bloodGroup', 'emergencyName', 'emergencyPhone', 'allergies', 'complaint', 'diagnosis'];
const pick = (body) => Object.fromEntries(FIELDS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));

// a bed can only be claimed if it is still available (prevents two people getting the same bed)
const claimBed = (id) => Bed.findOneAndUpdate({ _id: id, status: 'available' }, { status: 'occupied' });
const freeBed = (id) => (id ? Bed.findByIdAndUpdate(id, { status: 'available' }) : null);

async function nextPatientId() {
  const last = await Patient.findOne({ patientId: { $exists: true } }).sort('-createdAt').select('patientId');
  const n = last ? parseInt(last.patientId.replace(/\D/g, ''), 10) + 1 : 1;
  return `P-${String(n).padStart(4, '0')}`;
}

// ---------- helpers for the form dropdowns ----------
r.get('/doctors', async (_req, res) => {
  res.json(await User.find({ role: 'doctor' }).select('name specialization').sort('name'));
});

r.get('/beds/available', async (_req, res) => {
  const beds = await Bed.find({ status: 'available' })
    .populate({ path: 'room', select: 'number ward', populate: { path: 'ward', select: 'name' } }).lean();
  res.json(
    beds.filter((b) => b.room?.ward)
      .map((b) => ({ _id: b._id, label: `${b.room.ward.name} · Room ${b.room.number} · ${b.number}` }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
  );
});

// ---------- list (search + status filter) ----------
r.get('/', async (req, res) => {
  const { q, status } = req.query;
  const filter = {};
  if (['admitted', 'outpatient', 'discharged'].includes(status)) filter.status = status;
  if (q?.trim()) {
    const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { phone: rx }, { patientId: rx }];
  }
  res.json(await Patient.find(filter).populate('doctor', 'name specialization').populate(bedPopulate).sort('-createdAt'));
});

r.get('/:id', async (req, res) => {
  const p = await Patient.findById(req.params.id).populate('doctor', 'name specialization').populate(bedPopulate);
  if (!p) return res.status(404).json({ message: 'Patient not found' });
  res.json(p);
});

// ---------- register ----------
r.post('/', canWrite, async (req, res) => {
  const b = req.body;
  const need = { name: 'Name', age: 'Age', gender: 'Gender', phone: 'Phone', complaint: 'Reason for visit' };
  for (const k in need) if (!String(b[k] ?? '').trim()) return res.status(400).json({ message: `${need[k]} is required` });
  if (String(b.phone).replace(/\D/g, '').length !== 10) return res.status(400).json({ message: 'Phone must be 10 digits' });

  const status = b.status === 'admitted' ? 'admitted' : 'outpatient';
  let bed = null;
  if (status === 'admitted' && b.bedId) {
    if (!ok(b.bedId)) return res.status(400).json({ message: 'Invalid bed' });
    bed = await claimBed(b.bedId);
    if (!bed) return res.status(409).json({ message: 'That bed is no longer available' });
  }
  try {
    const p = await Patient.create({
      ...pick(b), doctor: b.doctor || undefined, status, bed: bed?._id,
      admittedAt: status === 'admitted' ? new Date() : undefined,
      patientId: await nextPatientId(),
    });
    res.status(201).json(p);
  } catch (e) {
    await freeBed(bed?._id);
    const bad = e.name === 'ValidationError';
    res.status(bad ? 400 : 500).json({ message: bad ? 'Please check the entered values' : 'Could not save patient' });
  }
});

// ---------- edit details ----------
r.put('/:id', canWrite, async (req, res) => {
  const p = await Patient.findById(req.params.id);
  if (!p) return res.status(404).json({ message: 'Patient not found' });
  Object.assign(p, pick(req.body));
  if (req.body.doctor !== undefined) p.doctor = req.body.doctor || undefined;
  try { await p.save(); res.json(p); }
  catch { res.status(400).json({ message: 'Please check the entered values' }); }
});

// ---------- assign or change bed ----------
r.post('/:id/assign-bed', canWrite, async (req, res) => {
  const p = await Patient.findById(req.params.id);
  if (!p) return res.status(404).json({ message: 'Patient not found' });
  if (p.status === 'discharged') return res.status(400).json({ message: 'This patient is discharged' });
  const { bedId } = req.body;
  if (!ok(bedId)) return res.status(400).json({ message: 'Select a bed' });
  if (String(p.bed) === bedId) return res.status(400).json({ message: 'Patient is already in this bed' });

  const bed = await claimBed(bedId);
  if (!bed) return res.status(409).json({ message: 'That bed is no longer available' });
  await freeBed(p.bed); // release the old bed, if any
  p.bed = bed._id;
  p.status = 'admitted';
  p.admittedAt ||= new Date();
  await p.save();
  res.json({ message: 'Bed assigned' });
});

// ---------- discharge (frees the bed) ----------
r.post('/:id/discharge', canWrite, async (req, res) => {
  const p = await Patient.findById(req.params.id);
  if (!p) return res.status(404).json({ message: 'Patient not found' });
  await freeBed(p.bed);
  p.bed = null;
  p.status = 'discharged';
  p.dischargedAt = new Date();
  await p.save();
  res.json({ message: 'Patient discharged' });
});

// ---------- delete (admin only) ----------
r.delete('/:id', authorize('admin'), async (req, res) => {
  const p = await Patient.findById(req.params.id);
  if (!p) return res.status(404).json({ message: 'Patient not found' });
  await freeBed(p.bed);
  await p.deleteOne();
  res.json({ message: 'Patient deleted' });
});

export default r;