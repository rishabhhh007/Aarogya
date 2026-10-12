import 'dotenv/config';
import mongoose from 'mongoose';
import User from './models/User.js';

await mongoose.connect(process.env.MONGO_URI);
await User.deleteMany({ email: 'admin@hms.com' });
await User.create({ name: 'Super Admin', email: 'admin@hms.com', password: 'Admin@123', role: 'admin' });
console.log('Admin created -> admin@hms.com / Admin@123');
process.exit();
