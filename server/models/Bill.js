import mongoose from 'mongoose';
const { Schema } = mongoose;

const billSchema = new Schema({
  billNo: String, // B-0001, B-0002...
  patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  items: [{ description: String, qty: Number, price: Number, _id: false }],
  discount: { type: Number, default: 0 },
  total: { type: Number, required: true }, // after discount, calculated on the server
  paid: { type: Number, default: 0 },
  payments: [{
    amount: Number,
    method: { type: String, enum: ['cash', 'upi', 'card'], default: 'cash' },
    date: { type: Date, default: Date.now },
    receivedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    _id: false,
  }],
  status: { type: String, enum: ['pending', 'partial', 'paid'], default: 'pending' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.models.Bill || mongoose.model('Bill', billSchema);