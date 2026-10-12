import 'dotenv/config';
import mongoose from 'mongoose';
import Bill from './models/Bill.js';
import { Patient } from './models/Hospital.js';

await mongoose.connect(process.env.MONGO_URI);
await Bill.deleteMany();

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const patients = await Patient.find({ status: { $ne: 'outpatient' } });
let n = 0;
for (const p of patients) {
  const days = 1 + Math.floor(Math.random() * 4);
  const items = [
    { description: 'Consultation fee', qty: 1, price: 500 },
    { description: `Bed charges (${days} days)`, qty: days, price: pick([1000, 1500, 2000, 5000]) },
    { description: 'Medicines and lab tests', qty: 1, price: 300 + Math.floor(Math.random() * 20) * 100 },
  ];
  const total = items.reduce((s, i) => s + i.qty * i.price, 0);
  const when = new Date(); when.setDate(when.getDate() - Math.floor(Math.random() * 14)); when.setHours(11, 0, 0, 0);
  const roll = Math.random();
  const paid = roll < 0.5 ? total : roll < 0.8 ? Math.round(total / 2) : 0;
  await Bill.create({
    billNo: `B-${String(++n).padStart(4, '0')}`, patient: p._id, items, discount: 0, total, paid,
    payments: paid ? [{ amount: paid, method: pick(['cash', 'upi', 'card']), date: when }] : [],
    status: paid <= 0 ? 'pending' : paid >= total ? 'paid' : 'partial', createdAt: when, updatedAt: when,
  });
}
console.log(`Created ${n} demo bills`);
process.exit();