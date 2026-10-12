import { Router } from 'express';
import mongoose from 'mongoose';
import LabTest from '../models/LabTest.js';
import { Patient } from '../models/Hospital.js';
import { protect, authorize } from '../middleware/auth.js';

const r = Router();
r.use(protect, authorize('admin', 'doctor'));
const ok = (id) => mongoose.isValidObjectId(id);
r.param('id', (req, res, next, id) => (ok(id) ? next() : res.status(400).json({ message: 'Invalid id' })));

const TESTS = ['Complete Blood Count', 'Blood Sugar (Fasting)', 'Blood Sugar (Random)', 'Lipid Profile', 'Liver Function Test',
  'Kidney Function Test', 'Urine Routine', 'Thyroid Profile', 'Chest X-Ray', 'ECG', 'CT Scan', 'MRI', 'Dengue NS1', 'Malaria Test', 'COVID-19 / Flu Test'];

r.get('/tests', (_req, res) => res.json(TESTS));

r.get('/', async (req, res) => {
  const f = {};
  if (['requested', 'completed'].includes(req.query.status)) f.status = req.query.status;
  if (ok(req.query.patient)) f.patient = req.query.patient;
  res.json(await LabTest.find(f).sort('-urgent -createdAt').limit(200)
    .populate('patient', 'name patientId').populate('requestedBy', 'name'));
});

r.post('/', async (req, res) => {
  const { patient, test, urgent } = req.body;
  if (!ok(patient) || !(await Patient.exists({ _id: patient }))) return res.status(400).json({ message: 'Select a patient' });
  if (!TESTS.includes(test)) return res.status(400).json({ message: 'Select a test' });
  res.status(201).json(await LabTest.create({ patient, test, urgent: !!urgent, requestedBy: req.user._id }));
});

r.put('/:id/result', async (req, res) => {
  const t = await LabTest.findById(req.params.id);
  if (!t) return res.status(404).json({ message: 'Lab test not found' });
  const result = String(req.body.result || '').trim().slice(0, 500);
  if (!result) return res.status(400).json({ message: 'Enter the result' });
  t.result = result;
  t.abnormal = !!req.body.abnormal;
  t.status = 'completed';
  t.completedAt = new Date();
  t.completedBy = req.user._id;
  await t.save();
  res.json(t);
});

export default r;