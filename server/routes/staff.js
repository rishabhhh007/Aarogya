import { Router } from 'express';
import User from '../models/User.js';
import { protect, authorize } from '../middleware/auth.js';

const r = Router();
r.use(protect, authorize('admin')); // every route here is admin-only

const ROLES = { doctors: 'doctor', receptionists: 'receptionist' };

// turns /doctors or /receptionists into a role, rejects anything else
r.use('/:type', (req, res, next) => {
  req.role = ROLES[req.params.type];
  if (!req.role) return res.status(404).json({ message: 'Unknown staff type' });
  next();
});

// List
r.get('/:type', async (req, res) => {
  res.json(await User.find({ role: req.role }).select('-password').sort('-createdAt'));
});

// Create
r.post('/:type', async (req, res) => {
  const { name, email, password, phone, specialization } = req.body;
  if (!name?.trim() || !email?.trim()) return res.status(400).json({ message: 'Name and email are required' });
  if (!password || password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
  if (req.role === 'doctor' && !specialization) return res.status(400).json({ message: 'Specialization is required for doctors' });

  const exists = await User.findOne({ email: email.toLowerCase().trim() });
  if (exists) return res.status(409).json({ message: 'A user with this email already exists' });

  const user = await User.create({
    name: name.trim(), email: email.toLowerCase().trim(), password, phone,
    role: req.role, specialization: req.role === 'doctor' ? specialization : undefined,
  });
  res.status(201).json({ id: user._id, name: user.name, role: user.role });
});

// Delete
r.delete('/:type/:id', async (req, res) => {
  const user = await User.findOneAndDelete({ _id: req.params.id, role: req.role });
  if (!user) return res.status(404).json({ message: 'Not found' });
  res.json({ message: 'Removed' });
});

export default r;