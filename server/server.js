import 'express-async-errors';
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
import vitals from './routes/vitals.js';
import labs from './routes/labs.js';
import duties from './routes/duties.js';
import chat from './routes/chat.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

// connect once and reuse the connection (important on serverless)
let dbPromise;
const connectDB = () =>
  (dbPromise ||= mongoose.connect(process.env.MONGO_URI).catch((e) => { dbPromise = null; throw e; }));
app.use(async (_req, _res, next) => { await connectDB(); next(); });

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

// any error inside a route returns a message instead of leaving the page waiting
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: `Server error: ${err.message}` });
});

if (process.env.VERCEL !== '1') {
  await connectDB(); // locally: fail fast if the database is unreachable
  app.listen(process.env.PORT || 5000, () => console.log('API running'));
}

export default app;