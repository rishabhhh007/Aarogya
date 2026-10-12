import { Router } from 'express';
import { Ward, Room, Bed, Patient } from '../models/Hospital.js';
import { protect, authorize } from '../middleware/auth.js';

const r = Router();
r.use(protect, authorize('admin'));

const byNumber = (a, b) => a.number.localeCompare(b.number, undefined, { numeric: true });

// Whole hierarchy in one call: wards -> rooms -> beds (with patient name on occupied beds)
r.get('/tree', async (_req, res) => {
  const [wards, rooms, beds, patients] = await Promise.all([
    Ward.find().sort('name').lean(),
    Room.find().lean(),
    Bed.find().lean(),
    Patient.find({ status: 'admitted', bed: { $ne: null } }).select('name bed').lean(),
  ]);
  const who = Object.fromEntries(patients.map((p) => [String(p.bed), p.name]));

  const bedsByRoom = {};
  beds.sort(byNumber).forEach((b) => {
    (bedsByRoom[String(b.room)] ||= []).push({ ...b, patient: who[String(b._id)] || null });
  });
  const roomsByWard = {};
  rooms.sort(byNumber).forEach((rm) => {
    (roomsByWard[String(rm.ward)] ||= []).push({ ...rm, beds: bedsByRoom[String(rm._id)] || [] });
  });
  res.json(wards.map((w) => ({ ...w, rooms: roomsByWard[String(w._id)] || [] })));
});

// ---------- Create ----------
r.post('/wards', async (req, res) => {
  const { name, type } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: 'Ward name is required' });
  if (await Ward.findOne({ name: new RegExp(`^${name.trim()}$`, 'i') }))
    return res.status(409).json({ message: 'A ward with this name already exists' });
  const ward = await Ward.create({ name: name.trim(), type });
  res.status(201).json(ward);
});

r.post('/wards/:id/rooms', async (req, res) => {
  const number = String(req.body.number || '').trim();
  if (!number) return res.status(400).json({ message: 'Room number is required' });
  const ward = await Ward.findById(req.params.id);
  if (!ward) return res.status(404).json({ message: 'Ward not found' });
  if (await Room.findOne({ ward: ward._id, number }))
    return res.status(409).json({ message: `Room ${number} already exists in this ward` });
  res.status(201).json(await Room.create({ number, ward: ward._id }));
});

// Add several beds at once: { count: 4 } creates the next 4 numbers (B1, B2, ...)
r.post('/rooms/:id/beds', async (req, res) => {
  const count = parseInt(req.body.count, 10);
  if (!count || count < 1 || count > 20) return res.status(400).json({ message: 'Enter a bed count between 1 and 20' });
  const room = await Room.findById(req.params.id);
  if (!room) return res.status(404).json({ message: 'Room not found' });

  const existing = await Bed.find({ room: room._id }).select('number');
  let last = Math.max(0, ...existing.map((b) => parseInt(b.number.replace(/\D/g, ''), 10) || 0));
  const docs = Array.from({ length: count }, () => ({ number: `B${++last}`, room: room._id }));
  res.status(201).json(await Bed.insertMany(docs));
});

// ---------- Delete (blocked while any bed is occupied) ----------
r.delete('/beds/:id', async (req, res) => {
  const bed = await Bed.findById(req.params.id);
  if (!bed) return res.status(404).json({ message: 'Bed not found' });
  if (bed.status === 'occupied') return res.status(400).json({ message: 'This bed is occupied by a patient' });
  await bed.deleteOne();
  res.json({ message: 'Bed removed' });
});

r.delete('/rooms/:id', async (req, res) => {
  if (await Bed.exists({ room: req.params.id, status: 'occupied' }))
    return res.status(400).json({ message: 'This room has an occupied bed' });
  await Bed.deleteMany({ room: req.params.id });
  await Room.findByIdAndDelete(req.params.id);
  res.json({ message: 'Room removed' });
});

r.delete('/wards/:id', async (req, res) => {
  const roomIds = (await Room.find({ ward: req.params.id }).select('_id')).map((x) => x._id);
  if (await Bed.exists({ room: { $in: roomIds }, status: 'occupied' }))
    return res.status(400).json({ message: 'This ward has occupied beds' });
  await Bed.deleteMany({ room: { $in: roomIds } });
  await Room.deleteMany({ ward: req.params.id });
  await Ward.findByIdAndDelete(req.params.id);
  res.json({ message: 'Ward removed' });
});

export default r;