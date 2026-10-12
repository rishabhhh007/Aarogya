import mongoose from 'mongoose';
const { Schema } = mongoose;

const appointmentSchema = new Schema({
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },   // 'YYYY-MM-DD'
    time: { type: String, required: true },   // 'HH:mm'
    reason: String,
    status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// The database itself refuses two active appointments for the same doctor, date and time
appointmentSchema.index(
    { doctor: 1, date: 1, time: 1 },
    { unique: true, partialFilterExpression: { status: 'scheduled' } }
);

export default mongoose.model('Appointment', appointmentSchema);