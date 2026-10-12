import { Router } from 'express';
import User from '../models/User.js';
import { Ward, Room, Bed, Patient } from '../models/Hospital.js';
import { protect, authorize } from '../middleware/auth.js';

const r = Router();

// latest patients with doctor and bed details (optionally filtered)
const recentPatients = (filter = {}) =>
  Patient.find(filter).sort('-createdAt').limit(8)
    .select('patientId name age gender status doctor bed createdAt')
    .populate('doctor', 'name')
    .populate({ path: 'bed', select: 'number room', populate: { path: 'room', select: 'number ward', populate: { path: 'ward', select: 'name' } } });

// ---------- Admin ----------
r.get('/stats', protect, authorize('admin'), async (_req, res) => {
  const [doctors, receptionists, wards, rooms, beds, availableBeds, recent] = await Promise.all([
    User.countDocuments({ role: 'doctor' }),
    User.countDocuments({ role: 'receptionist' }),
    Ward.countDocuments(), Room.countDocuments(), Bed.countDocuments(),
    Bed.countDocuments({ status: 'available' }),
    recentPatients(),
  ]);
  res.json({ doctors, receptionists, wards, rooms, beds, availableBeds, occupiedBeds: beds - availableBeds, recent });
});

// ---------- Doctor and receptionist ----------
r.get('/my-stats', protect, authorize('doctor', 'receptionist'), async (req, res) => {
  if (req.user.role === 'doctor') {
    const mine = { doctor: req.user._id }; // a doctor only ever sees their own patients
    const [total, admitted, outpatients, recent] = await Promise.all([
      Patient.countDocuments(mine),
      Patient.countDocuments({ ...mine, status: 'admitted' }),
      Patient.countDocuments({ ...mine, status: 'outpatient' }),
      recentPatients(mine),
    ]);
    return res.json({ total, admitted, outpatients, recent });
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const [today, waiting, freeBeds, admitted, recent] = await Promise.all([
    Patient.countDocuments({ createdAt: { $gte: start } }),
    Patient.countDocuments({ status: 'admitted', bed: null }), // admitted but no bed yet
    Bed.countDocuments({ status: 'available' }),
    Patient.countDocuments({ status: 'admitted' }),
    recentPatients(),
  ]);
  res.json({ today, waiting, freeBeds, admitted, recent });
});

export default r;