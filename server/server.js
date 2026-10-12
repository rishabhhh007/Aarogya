import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import auth from './routes/auth.js';
import dashboard from './routes/dashboard.js';
import patients from './routes/patients.js';
import staff from './routes/staff.js';
import infra from './routes/infra.js';
import appointments from './routes/appointments.js';
import billing from './routes/billing.js';
import reports from './routes/reports.js';
import 'express-async-errors';
import vitals from './routes/vitals.js';
import labs from './routes/labs.js';
import duties from './routes/duties.js';
import chat from './routes/chat.js';

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());
app.use('/api/auth', auth);
app.use('/api/dashboard', dashboard);
app.use('/api/patients', patients);
app.use('/api/staff', staff);
app.use('/api/infra', infra);
app.use('/api/appointments', appointments);
app.use('/api/billing', billing);
app.use('/api/reports', reports);
app.use('/api/vitals', vitals);
app.use('/api/labs', labs);
app.use('/api/duties', duties);
app.use('/api/chat', chat);

// any error inside a route now returns a message instead of leaving the page waiting
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: `Server error: ${err.message}` });
});

await mongoose.connect(process.env.MONGO_URI);
app.listen(process.env.PORT || 5000, () => console.log('API running'));

