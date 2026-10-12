import 'dotenv/config';
import mongoose from 'mongoose';
import User from './models/User.js';
import Vital from './models/Vital.js';
import LabTest from './models/LabTest.js';
import Duty from './models/Duty.js';
import { Ward, Patient } from './models/Hospital.js';

await mongoose.connect(process.env.MONGO_URI);
await Promise.all([Vital.deleteMany(), LabTest.deleteMany(), Duty.deleteMany()]);

const rnd = (a, b) => Math.round((a + Math.random() * (b - a)) * 10) / 10;
const int = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const hoursAgo = (h) => new Date(Date.now() - h * 3600e3);
const pad = (n) => String(n).padStart(2, '0');
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

const profile = (kind) => {
  const v = { temperature: rnd(36.4, 37.2), systolic: int(110, 125), diastolic: int(70, 82), pulse: int(65, 85), spo2: int(96, 99), respRate: int(14, 18) };
  if (kind === 'warn') Object.assign(v, pick([{ spo2: int(91, 93) }, { temperature: rnd(38, 38.9) }, { systolic: int(145, 165), diastolic: int(92, 100) }, { pulse: int(102, 115) }]));
  if (kind === 'critical') Object.assign(v, pick([{ spo2: int(84, 89), respRate: int(28, 34) }, { systolic: int(185, 200), diastolic: int(120, 130) }, { temperature: rnd(39.6, 40.5), pulse: int(125, 140) }]));
  return v;
};

const [doctors, wards, patients] = await Promise.all([User.find({ role: 'doctor' }), Ward.find(), Patient.find({ status: 'admitted' })]);
if (!doctors.length || !wards.length) { console.log('Run "npm run demo" first (needs doctors and wards).'); process.exit(); }

const tests = ['Complete Blood Count', 'Blood Sugar (Fasting)', 'Chest X-Ray', 'ECG', 'Kidney Function Test', 'Dengue NS1'];
for (const p of patients) {
  const roll = Math.random();
  const kind = roll < 0.2 ? 'critical' : roll < 0.55 ? 'warn' : 'normal';
  const latestAgo = int(1, 14);
  for (let i = int(1, 3) - 1; i >= 0; i--) {
    const at = hoursAgo(latestAgo + i * int(6, 12));
    await Vital.create({ patient: p._id, ...profile(i === 0 ? kind : 'normal'), createdAt: at, updatedAt: at });
  }
  for (let n = int(0, 2); n > 0; n--) {
    const done = Math.random() < 0.6;
    await LabTest.create({
      patient: p._id, requestedBy: pick(doctors)._id, test: pick(tests), urgent: !done && kind !== 'normal' && Math.random() < 0.6,
      status: done ? 'completed' : 'requested', result: done ? pick(['Within normal range', 'Slightly elevated, review advised']) : undefined,
      abnormal: done && Math.random() < 0.3, completedAt: done ? new Date() : undefined,
    });
  }
}

let duties = 0;
for (const d of doctors) for (let i = 0; i < 7; i++) {
  await Duty.create({ doctor: d._id, ward: pick(wards)._id, date: day(i), shift: pick(['morning', 'evening', 'night']) });
  duties++;
}
console.log(`Created vitals and labs for ${patients.length} admitted patients and ${duties} duties`);
process.exit();