import mongoose from 'mongoose';
const { Schema, model } = mongoose;

export const Ward = model('Ward', new Schema({
  name: { type: String, required: true, unique: true },
  type: { type: String, enum: ['General', 'ICU', 'Emergency', 'Maternity', 'Pediatric', 'Surgical'], default: 'General' },
}));
export const Room = model('Room', new Schema({
  number: { type: String, required: true }, ward: { type: Schema.Types.ObjectId, ref: 'Ward', required: true } }));
export const Bed = model('Bed', new Schema({
  number: { type: String, required: true },
  room: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
  status: { type: String, enum: ['available', 'occupied'], default: 'available' } }));

export const Patient = model('Patient', new Schema({
  patientId: String, // P-0001, P-0002...
  name: { type: String, required: true, trim: true },
  age: { type: Number, min: 0, max: 120 },
  gender: String,
  phone: String,
  bloodGroup: String,
  address: String,
  emergencyName: String,
  emergencyPhone: String,
  allergies: String,
  complaint: String,   // reason for visit
  diagnosis: String,
  doctor: { type: Schema.Types.ObjectId, ref: 'User' },
  bed: { type: Schema.Types.ObjectId, ref: 'Bed' },
  status: { type: String, enum: ['admitted', 'discharged', 'outpatient'], default: 'outpatient' },
  admittedAt: Date,
  dischargedAt: Date,
}, { timestamps: true }));
