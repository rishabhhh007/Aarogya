import { Router } from 'express';
import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import Bill from '../models/Bill.js';
import { Ward, Room, Bed, Patient } from '../models/Hospital.js';
import { protect, authorize } from '../middleware/auth.js';

const r = Router();
r.use(protect, authorize('admin'));

const pad = (n) => String(n).padStart(2, '0');
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

r.get('/summary', async (req, res) => {
  const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
  const keys = [];
  for (let i = days - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); keys.push(key(d)); }

  const [patients, bills, appts, wards, rooms, beds, doctors] = await Promise.all([
    Patient.find().select('status admittedAt dischargedAt doctor').lean(),
    Bill.find().select('total paid payments').lean(),
    Appointment.find({ date: { $gte: keys[0], $lte: keys[keys.length - 1] } }).select('doctor status').lean(),
    Ward.find().select('name').sort('name').lean(),
    Room.find().select('ward').lean(),
    Bed.find().select('room status').lean(),
    User.find({ role: 'doctor' }).select('name specialization').lean(),
  ]);

  // day-by-day trend: admissions, discharges, money collected
  const trend = Object.fromEntries(keys.map((k) => [k, { date: k, admissions: 0, discharges: 0, revenue: 0 }]));
  patients.forEach((p) => {
    if (p.admittedAt) { const t = trend[key(new Date(p.admittedAt))]; if (t) t.admissions++; }
    if (p.dischargedAt) { const t = trend[key(new Date(p.dischargedAt))]; if (t) t.discharges++; }
  });
  const methods = { cash: 0, upi: 0, card: 0 };
  let collected = 0;
  bills.forEach((b) => (b.payments || []).forEach((py) => {
    const t = trend[key(new Date(py.date))];
    if (t) { t.revenue += py.amount; methods[py.method] = (methods[py.method] || 0) + py.amount; collected += py.amount; }
  }));
  const pending = bills.reduce((s, b) => s + (b.total - b.paid), 0);

  // bed occupancy per ward
  const roomWard = Object.fromEntries(rooms.map((rm) => [String(rm._id), String(rm.ward)]));
  const ward = Object.fromEntries(wards.map((w) => [String(w._id), { name: w.name, occupied: 0, available: 0 }]));
  beds.forEach((b) => { const w = ward[roomWard[String(b.room)]]; if (w) w[b.status === 'occupied' ? 'occupied' : 'available']++; });

  // patients by status and by department (the doctor's specialization)
  const status = ['admitted', 'outpatient', 'discharged'].map((s) => ({ name: s, value: patients.filter((p) => p.status === s).length }));
  const spec = Object.fromEntries(doctors.map((d) => [String(d._id), d.specialization || 'General']));
  const dept = {};
  patients.forEach((p) => { const n = p.doctor ? spec[String(p.doctor)] || 'General' : 'Unassigned'; dept[n] = (dept[n] || 0) + 1; });

  // appointments per doctor in the period
  const perDoc = Object.fromEntries(doctors.map((d) => [String(d._id), { name: d.name.replace(/^Dr\.\s*/, ''), completed: 0, scheduled: 0, cancelled: 0 }]));
  appts.forEach((a) => { const x = perDoc[String(a.doctor)]; if (x) x[a.status]++; });

  const occupied = beds.filter((b) => b.status === 'occupied').length;
  res.json({
    days,
    kpi: {
      patients: patients.length,
      admitted: patients.filter((p) => p.status === 'admitted').length,
      occupancy: beds.length ? Math.round((occupied / beds.length) * 100) : 0,
      collected, pending, appointments: appts.length,
    },
    trend: keys.map((k) => trend[k]),
    wards: Object.values(ward),
    status,
    departments: Object.entries(dept).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    doctors: Object.values(perDoc),
    methods: Object.entries(methods).map(([name, value]) => ({ name, value })),
  });
});

export default r;