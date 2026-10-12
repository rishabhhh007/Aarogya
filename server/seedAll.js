import 'dotenv/config';
import mongoose from 'mongoose';
import User from './models/User.js';
import Appointment from './models/Appointment.js';
import Bill from './models/Bill.js';
import Vital from './models/Vital.js';
import LabTest from './models/LabTest.js';
import Duty from './models/Duty.js';
import { Ward, Room, Bed, Patient } from './models/Hospital.js';

await mongoose.connect(process.env.MONGO_URI);
await Promise.all([Appointment, Bill, Vital, LabTest, Duty, Patient, Bed, Room, Ward].map((m) => m.deleteMany()));
await User.deleteMany({ role: { $in: ['doctor', 'receptionist'] } });

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const int = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const rnd = (a, b) => Math.round((a + Math.random() * (b - a)) * 10) / 10;
const phone = () => String(6 + int(0, 3)) + String(int(0, 999999999)).padStart(9, '0');
const pad = (n) => String(n).padStart(2, '0');
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const ago = (days, h = 10) => { const d = new Date(); d.setDate(d.getDate() - days); d.setHours(h, 0, 0, 0); return d; };

// ---------- staff (every demo password: Demo@123) ----------
const doctors = [];
for (const [name, email, spec] of [
  ['Dr. Anil Sharma', 'anil@hms.com', 'Cardiology'], ['Dr. Priya Patel', 'priya@hms.com', 'Pediatrics'],
  ['Dr. Rahul Mehta', 'rahul@hms.com', 'Orthopedics'], ['Dr. Sneha Joshi', 'sneha@hms.com', 'Gynecology'],
  ['Dr. Vikram Singh', 'vikram@hms.com', 'General Medicine'], ['Dr. Kavya Nair', 'kavya@hms.com', 'Neurology'],
]) doctors.push(await User.create({ name, email, password: 'Demo@123', role: 'doctor', specialization: spec, phone: phone() }));
for (const [name, email] of [['Neha Verma', 'neha@hms.com'], ['Rohan Desai', 'rohan@hms.com']])
  await User.create({ name, email, password: 'Demo@123', role: 'receptionist', phone: phone() });

// ---------- wards -> rooms -> beds ----------
const layout = [
  { name: 'General Ward A', type: 'General', rooms: 3, beds: 4 }, { name: 'ICU', type: 'ICU', rooms: 2, beds: 3 },
  { name: 'Maternity Ward', type: 'Maternity', rooms: 2, beds: 3 }, { name: 'Pediatric Ward', type: 'Pediatric', rooms: 2, beds: 4 },
];
const wards = [], beds = [];
for (const [i, w] of layout.entries()) {
  const ward = await Ward.create({ name: w.name, type: w.type });
  wards.push(ward);
  for (let r = 1; r <= w.rooms; r++) {
    const room = await Room.create({ number: String((i + 1) * 100 + r), ward: ward._id });
    for (let b = 1; b <= w.beds; b++) beds.push(await Bed.create({ number: `B${b}`, room: room._id }));
  }
}

// ---------- patients: 12 admitted, 6 outpatient, 6 discharged ----------
const people = [['Shubh Kapoor', 21, 'Male'], ['Anita Verma', 34, 'Female'], ['Ravi Patel', 58, 'Male'], ['Meera Shah', 42, 'Female'],
  ['Arjun Reddy', 29, 'Male'], ['Pooja Iyer', 36, 'Female'], ['Karan Malhotra', 47, 'Male'], ['Divya Menon', 25, 'Female'],
  ['Suresh Kumar', 66, 'Male'], ['Lakshmi Rao', 71, 'Female'], ['Aarav Gupta', 6, 'Male'], ['Ishita Bose', 9, 'Female'],
  ['Mohan Das', 54, 'Male'], ['Farah Khan', 31, 'Female'], ['Nikhil Jain', 38, 'Male'], ['Tanvi Pillai', 27, 'Female'],
  ['Harish Chandra', 62, 'Male'], ['Sunita Yadav', 49, 'Female'], ['Dev Mishra', 12, 'Male'], ['Riya Sen', 23, 'Female'],
  ['Prakash Nair', 73, 'Male'], ['Zoya Ali', 33, 'Female'], ['Manish Tiwari', 44, 'Male'], ['Kriti Saxena', 28, 'Female']];
const complaints = ['Fever and cough', 'Chest pain', 'Fracture in left arm', 'Abdominal pain', 'Severe headache', 'Breathing difficulty', 'Routine check-up', 'High blood pressure', 'Back pain', 'Dizziness and weakness'];
const diagnoses = ['Viral fever', 'Angina', 'Hairline fracture', 'Gastritis', 'Migraine', 'Asthma', 'Hypertension', 'Lumbar strain'];
const cities = ['Bhuj', 'Gandhidham', 'Anjar', 'Mundra', 'Mandvi', 'Rapar'];

const free = [...beds], patients = [];
for (const [i, [name, age, gender]] of people.entries()) {
  let status = i < 12 ? 'admitted' : i < 18 ? 'outpatient' : 'discharged';
  const created = ago(int(0, 13), 9 + (i % 8));
  const p = { patientId: `P-${String(i + 1).padStart(4, '0')}`, name, age, gender, phone: phone(), bloodGroup: pick(['A+', 'B+', 'O+', 'AB+', 'O-', 'B-']),
    address: `${pick(cities)}, Gujarat`, emergencyName: 'Family member', emergencyPhone: phone(), allergies: pick(['', '', 'Penicillin', 'Dust']),
    complaint: pick(complaints), diagnosis: status === 'outpatient' ? '' : pick(diagnoses), doctor: pick(doctors)._id, status, createdAt: created, updatedAt: created };
  if (status === 'admitted') {
    const bed = free.shift();
    if (bed) { p.bed = bed._id; p.admittedAt = created; await Bed.findByIdAndUpdate(bed._id, { status: 'occupied' }); } else p.status = 'outpatient';
  }
  if (status === 'discharged') { p.admittedAt = created; p.dischargedAt = new Date(created.getTime() + 3 * 86400000); }
  patients.push(await Patient.create(p));
}

// ---------- vitals + lab tests (admitted patients) ----------
const profile = (kind) => {
  const v = { temperature: rnd(36.4, 37.2), systolic: int(110, 125), diastolic: int(70, 82), pulse: int(65, 85), spo2: int(96, 99), respRate: int(14, 18) };
  if (kind === 'warn') Object.assign(v, pick([{ spo2: int(91, 93) }, { temperature: rnd(38, 38.9) }, { systolic: int(145, 165), diastolic: int(92, 100) }, { pulse: int(102, 115) }]));
  if (kind === 'critical') Object.assign(v, pick([{ spo2: int(84, 89), respRate: int(28, 34) }, { systolic: int(185, 200), diastolic: int(120, 130) }, { temperature: rnd(39.6, 40.5), pulse: int(125, 140) }]));
  return v;
};
const tests = ['Complete Blood Count', 'Blood Sugar (Fasting)', 'Chest X-Ray', 'ECG', 'Kidney Function Test', 'Dengue NS1'];
for (const p of patients.filter((x) => x.status === 'admitted')) {
  const roll = Math.random(), kind = roll < 0.2 ? 'critical' : roll < 0.55 ? 'warn' : 'normal';
  for (let i = int(1, 3) - 1; i >= 0; i--) {
    const at = new Date(Date.now() - (int(1, 12) + i * int(6, 12)) * 3600e3);
    await Vital.create({ patient: p._id, ...profile(i === 0 ? kind : 'normal'), createdAt: at, updatedAt: at });
  }
  for (let n = int(0, 2); n > 0; n--) {
    const done = Math.random() < 0.6;
    await LabTest.create({ patient: p._id, requestedBy: pick(doctors)._id, test: pick(tests), urgent: !done && kind !== 'normal' && Math.random() < 0.6,
      status: done ? 'completed' : 'requested', result: done ? pick(['Within normal range', 'Slightly elevated, review advised']) : undefined, abnormal: done && Math.random() < 0.3, completedAt: done ? new Date() : undefined });
  }
}

// ---------- ward duties: 7 days for every doctor ----------
for (const d of doctors) for (let i = 0; i < 7; i++) await Duty.create({ doctor: d._id, ward: pick(wards)._id, date: day(i), shift: pick(['morning', 'evening', 'night']) });

// ---------- appointments: today at 16:00, tomorrow at 10:00 and 10:30 ----------
const when = [[day(0), '16:00'], [day(1), '10:00'], [day(1), '10:30']];
for (let i = 0; i < 18; i++) {
  const [date, time] = when[Math.floor(i / 6)];
  await Appointment.create({ patient: patients[i % patients.length]._id, doctor: doctors[i % 6]._id, date, time, reason: pick(complaints), status: 'scheduled' });
}

// ---------- bills for admitted and discharged patients ----------
let n = 0;
for (const p of patients.filter((x) => x.status !== 'outpatient')) {
  const days = int(1, 4);
  const items = [{ description: 'Consultation fee', qty: 1, price: 500 }, { description: `Bed charges (${days} days)`, qty: days, price: pick([1000, 1500, 2000, 5000]) },
    { description: 'Medicines and lab tests', qty: 1, price: 300 + int(0, 19) * 100 }];
  const total = items.reduce((s, i) => s + i.qty * i.price, 0), at = ago(int(0, 13), 11), roll = Math.random();
  const paid = roll < 0.5 ? total : roll < 0.8 ? Math.round(total / 2) : 0;
  await Bill.create({ billNo: `B-${String(++n).padStart(4, '0')}`, patient: p._id, items, discount: 0, total, paid,
    payments: paid ? [{ amount: paid, method: pick(['cash', 'upi', 'card']), date: at }] : [], status: paid <= 0 ? 'pending' : paid >= total ? 'paid' : 'partial', createdAt: at, updatedAt: at });
}

console.log(`Done: ${doctors.length} doctors, 2 receptionists, ${wards.length} wards, ${beds.length} beds, ${patients.length} patients, 18 appointments, ${n} bills.`);
console.log('Staff password: Demo@123   e.g. anil@hms.com (doctor), neha@hms.com (receptionist)');
process.exit();