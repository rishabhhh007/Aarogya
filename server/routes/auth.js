import { Router } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const r = Router();

r.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email?.toLowerCase() }).select('+password');
  if (!user || !(await user.matches(password))) return res.status(401).json({ message: 'Invalid credentials' });
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
});

// Restores session + role on page refresh
r.get('/me', protect, (req, res) =>
  res.json({ user: { id: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role } }));

// Change display name / login email
r.put('/profile', protect, async (req, res) => {
  const { name, email } = req.body;
  if (!name?.trim() || !email?.trim()) return res.status(400).json({ message: 'Name and email are required' });
  const taken = await User.findOne({ email: email.toLowerCase().trim(), _id: { $ne: req.user._id } });
  if (taken) return res.status(409).json({ message: 'That email is already in use' });
  req.user.name = name.trim();
  req.user.email = email.toLowerCase().trim();
  await req.user.save();
  res.json({ user: { id: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role } });
});

// Change password
r.put('/password', protect, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' });
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.matches(currentPassword))) return res.status(400).json({ message: 'Current password is incorrect' });
  user.password = newPassword; // hashed automatically by the model
  await user.save();
  res.json({ message: 'Password updated' });
});
export default r;
