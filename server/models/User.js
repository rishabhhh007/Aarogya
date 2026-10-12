import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'doctor', 'receptionist'], required: true },
  phone: String,
  specialization: String, // sirf soctors k liye ye wala 
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 10);
  next();
});
userSchema.methods.matches = function (plain) { return bcrypt.compare(plain, this.password); };

export default mongoose.model('User', userSchema);
