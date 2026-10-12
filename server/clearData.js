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
const everything = process.argv.includes('--everything');

await Promise.all([Appointment, Bill, Vital, LabTest, Duty, Patient, Bed, Room, Ward].map((m) => m.deleteMany()));
await User.deleteMany(everything ? {} : { role: { $in: ['doctor', 'receptionist'] } });

console.log(everything
  ? 'Everything deleted, including the admin. Run "npm run seed" to create the admin again.'
  : 'Deleted all patients, staff, wards, rooms, beds, appointments, bills, vitals, labs and duties. Admin kept.');
process.exit();