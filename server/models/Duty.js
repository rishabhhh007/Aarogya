import mongoose from 'mongoose';
const { Schema } = mongoose;

const dutySchema = new Schema({
  doctor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  ward: { type: Schema.Types.ObjectId, ref: 'Ward', required: true },
  date: { type: String, required: true }, // 'YYYY-MM-DD'
  shift: { type: String, enum: ['morning', 'evening', 'night'], required: true },
  changes: [{
    at: Date, fromShift: String, toShift: String, fromWard: String, toWard: String,
    reason: String, patientName: String, by: { type: Schema.Types.ObjectId, ref: 'User' }, _id: false,
  }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// a doctor cannot have two duties in the same shift on the same day
dutySchema.index({ doctor: 1, date: 1, shift: 1 }, { unique: true });

export default mongoose.models.Duty || mongoose.model('Duty', dutySchema);