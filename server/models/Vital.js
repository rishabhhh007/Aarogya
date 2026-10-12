import mongoose from 'mongoose';
const { Schema } = mongoose;

const vitalSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  temperature: Number, // °C
  systolic: Number,
  diastolic: Number,
  pulse: Number,
  spo2: Number,
  respRate: Number,
  notes: String,
  recordedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.models.Vital || mongoose.model('Vital', vitalSchema);