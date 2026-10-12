import mongoose from 'mongoose';
const { Schema } = mongoose;

const labSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  test: { type: String, required: true },
  urgent: { type: Boolean, default: false },
  status: { type: String, enum: ['requested', 'completed'], default: 'requested' },
  result: String,
  abnormal: { type: Boolean, default: false },
  completedAt: Date,
  completedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.models.LabTest || mongoose.model('LabTest', labSchema);