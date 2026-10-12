import { Router } from 'express';
import mongoose from 'mongoose';
import Vital from '../models/Vital.js';
import LabTest from '../models/LabTest.js';
import { Patient } from '../models/Hospital.js';
import { protect, authorize } from '../middleware/auth.js';
import { vitalFlags, assess } from '../lib/priority.js';

const r = Router();
r.use(protect);
const ok = (id) => mongoose.isValidObjectId(id);

const FIELDS = {
  temperature: ['Temperature', 30, 45], systolic: ['Systolic BP', 50, 260], diastolic: ['Diastolic BP', 30, 160],
  pulse: ['Pulse', 20, 250], spo2: ['SpO2', 50, 100], respRate: ['Breathing rate', 4, 60],
};

// Record vitals (admin, doctor, receptionist)
r.post('/', authorize('admin', 'doctor', 'receptionist'), async (req, res) => {
  if (!ok(req.body.patient) || !(await Patient.exists({ _id: req.body.patient }))) return res.status(400).json({ message: 'Select a patient' });
  const doc = { patient: req.body.patient, recordedBy: req.user._id, notes: String(req.body.notes || '').trim().slice(0, 300) };
  let any = false;
  for (const k in FIELDS) {
    const raw = req.body[k];
    if (raw === '' || raw == null) continue;
    const n = Number(raw);
    const [label, min, max] = FIELDS[k];
    if (!Number.isFinite(n) || n < min || n > max) return res.status(400).json({ message: `${label} must be between ${min} and ${max}` });
    doc[k] = n; any = true;
  }
  if (!any) return res.status(400).json({ message: 'Enter at least one measurement' });
  if ((doc.systolic == null) !== (doc.diastolic == null)) return res.status(400).json({ message: 'Enter both systolic and diastolic BP' });
  if (doc.systolic != null && doc.diastolic >= doc.systolic) return res.status(400).json({ message: 'Systolic must be higher than diastolic' });
  res.status(201).json(await Vital.create(doc));
});

// History for one patient
r.get('/patient/:id', authorize('admin', 'doctor', 'receptionist'), async (req, res) => {
  if (!ok(req.params.id)) return res.status(400).json({ message: 'Invalid id' });
  const list = await Vital.find({ patient: req.params.id }).sort('-createdAt').limit(20).populate('recordedBy', 'name').lean();
  res.json(list.map((v) => ({ ...v, flags: vitalFlags(v) })));
});

// Priority list: admitted patients ranked by urgency (decision support, rule-based)
r.get('/priority', authorize('admin', 'doctor'), async (_req, res) => {
  const patients = await Patient.find({ status: 'admitted' })
    .select('patientId name age gender bed')
    .populate({ path: 'bed', select: 'number room', populate: { path: 'room', select: 'number ward', populate: { path: 'ward', select: 'name type' } } })
    .lean();
  const ids = patients.map((p) => p._id);
  const [latest, urgent] = await Promise.all([
    Vital.aggregate([{ $match: { patient: { $in: ids } } }, { $sort: { createdAt: -1 } }, { $group: { _id: '$patient', v: { $first: '$$ROOT' } } }]),
    LabTest.find({ patient: { $in: ids }, status: 'requested', urgent: true }).select('patient').lean(),
  ]);
  const lastBy = Object.fromEntries(latest.map((x) => [String(x._id), x.v]));
  const urgentSet = new Set(urgent.map((u) => String(u.patient)));

  const list = patients.map((p) => {
    const v = lastBy[String(p._id)] || null;
    const ward = p.bed?.room?.ward || null;
    return {
      _id: p._id, patientId: p.patientId, name: p.name, age: p.age, gender: p.gender,
      ward, place: p.bed ? `${ward?.name} · Room ${p.bed.room?.number} · ${p.bed.number}` : 'No bed yet',
      vitals: v, flags: vitalFlags(v),
      ...assess(p, v, { wardType: ward?.type, urgentLab: urgentSet.has(String(p._id)) }),
    };
  }).sort((a, b) => b.score - a.score);
  res.json(list);
});

export default r;