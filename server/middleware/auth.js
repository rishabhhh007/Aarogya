import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Verifies token and loads user (role define hota h database se ..client nhi batata)

export const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token){
      return res.status(401).json({ message: 'Not authenticated' });
    } 
    const { id } = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(id);
    if (!req.user) return res.status(401).json({ message: 'User not found' });
    next();
  } catch { res.status(401).json({ message: 'Invalid or expired token' }); }
};

// RBAC gate: authorize('admin') or authorize('admin','receptionist')
export const authorize = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'Forbidden' });
