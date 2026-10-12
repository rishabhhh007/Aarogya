import { Type } from '@google/genai';
import Appointment from '../models/Appointment.js';
import Duty from '../models/Duty.js';
import Vital from '../models/Vital.js';
import LabTest from '../models/LabTest.js';
import Bill from '../models/Bill.js';
import User from '../models/User.js';
import { Bed, Patient } from '../models/Hospital.js';
import { vitalFlags, assess } from '../lib/priority.js';

const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => fmt(new Date());
const addDays = (s, n) => { const d = new Date(`${s}T00:00:00`); d.setDate(d.getDate() + n); return fmt(d); };
const validDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
const rx = (s) => new RegExp(String(s).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
const dateOr = (d) => (validDate(d) ? d : today());

const SLOTS = [];
for (let h = 9; h < 17; h++) for (const m of ['00', '30']) if (h !== 13) SLOTS.push(`${pad(h)}:${m}`);

const bedPop = { path: 'bed', select: 'number room', populate: { path: 'room', select: 'number ward', populate: { path: 'ward', select: 'name type' } } };
const place = (bed) => (bed ? `${bed.room?.ward?.name} · Room ${bed.room?.number} · ${bed.number}` : 'no bed');

// Patients matching a name or ID. A doctor only ever finds their own patients.
async function findPatients(user, query, limit = 5) {
  const q = String(query || '').trim();
  if (!q) return [];
  const f = { $or: [{ name: rx(q) }, { patientId: rx(q) }] };
  if (user.role === 'doctor') {
    const mine = await Appointment.distinct('patient', { doctor: user._id });
    f.$and = [{ $or: [{ doctor: user._id }, { _id: { $in: mine } }] }];
  }
  return Patient.find(f).limit(limit).populate('doctor', 'name').populate(bedPop);
}

async function priorityList(limit = 5) {
  const patients = await Patient.find({ status: 'admitted' }).select('patientId name age gender bed').populate(bedPop).lean();
  const ids = patients.map((p) => p._id);
  const [latest, urgent] = await Promise.all([
    Vital.aggregate([{ $match: { patient: { $in: ids } } }, { $sort: { createdAt: -1 } }, { $group: { _id: '$patient', v: { $first: '$$ROOT' } } }]),
    LabTest.find({ patient: { $in: ids }, status: 'requested', urgent: true }).select('patient').lean(),
  ]);
  const by = Object.fromEntries(latest.map((x) => [String(x._id), x.v]));
  const urg = new Set(urgent.map((u) => String(u.patient)));
  return patients
    .map((p) => {
      const a = assess(p, by[String(p._id)] || null, { wardType: p.bed?.room?.ward?.type, urgentLab: urg.has(String(p._id)) });
      return { name: p.name, patientId: p.patientId, age: p.age, location: place(p.bed), level: a.level, score: a.score, reasons: a.reasons };
    })
    .sort((a, b) => b.score - a.score).slice(0, limit);
}

const obj = (properties, required = []) => ({ type: Type.OBJECT, properties, required });
const dateProp = { type: Type.STRING, description: 'Date as YYYY-MM-DD. Omit for today.' };

export const TOOLS = {
  get_my_schedule: {
    roles: ['doctor'],
    decl: { name: 'get_my_schedule', description: "The logged-in doctor's appointments for a date.", parameters: obj({ date: dateProp }) },
    run: async ({ date }, user) => {
      const d = dateOr(date);
      const rows = await Appointment.find({ doctor: user._id, date: d, status: 'scheduled' }).sort('time').populate('patient', 'name patientId');
      return { date: d, count: rows.length, appointments: rows.map((a) => ({ time: a.time, patient: a.patient?.name, reason: a.reason || null, arrived: !!a.checkedInAt })) };
    },
  },

  get_duty_roster: {
    roles: ['doctor', 'admin'],
    decl: { name: 'get_duty_roster', description: 'Ward duty (ward and shift). A doctor gets their own duties. The admin gets every doctor.', parameters: obj({ date: dateProp, days: { type: Type.INTEGER, description: 'Number of days from the date (1 to 14). Default 1.' } }) },
    run: async ({ date, days }, user) => {
      const from = dateOr(date);
      const to = addDays(from, Math.min(Math.max(parseInt(days, 10) || 1, 1), 14) - 1);
      const f = { date: { $gte: from, $lte: to } };
      if (user.role === 'doctor') f.doctor = user._id;
      const rows = await Duty.find(f).sort('date shift').limit(60).populate('doctor', 'name').populate('ward', 'name');
      return { from, to, duties: rows.map((d) => ({ date: d.date, shift: d.shift, ward: d.ward?.name, ...(user.role === 'admin' && { doctor: d.doctor?.name }) })) };
    },
  },

  get_priority_patients: {
    roles: ['doctor', 'admin'],
    decl: { name: 'get_priority_patients', description: 'Admitted patients ranked by urgency, with the reasons. Decision support only.', parameters: obj({ limit: { type: Type.INTEGER, description: 'How many to return (default 5, max 10).' } }) },
    run: async ({ limit }) => ({ patients: await priorityList(Math.min(Math.max(parseInt(limit, 10) || 5, 1), 10)) }),
  },

  get_patient_summary: {
    roles: ['doctor', 'admin'],
    decl: { name: 'get_patient_summary', description: 'Clinical summary of one patient: latest vitals, pending lab tests, recent diagnoses.', parameters: obj({ name_or_id: { type: Type.STRING, description: 'Patient name or ID like P-0003' } }, ['name_or_id']) },
    run: async ({ name_or_id }, user) => {
      const found = await findPatients(user, name_or_id);
      if (!found.length) return { found: false, note: 'No matching patient, or not one of your patients.' };
      if (found.length > 1) return { found: false, note: 'Several patients match. Ask which one.', matches: found.map((p) => `${p.name} (${p.patientId})`) };
      const p = found[0];
      const [v, labs, visits] = await Promise.all([
        Vital.findOne({ patient: p._id }).sort('-createdAt').lean(),
        LabTest.find({ patient: p._id, status: 'requested' }).select('test urgent').lean(),
        Appointment.find({ patient: p._id, status: 'completed' }).sort('-date').limit(3).select('date diagnosis').lean(),
      ]);
      return {
        name: p.name, patientId: p.patientId, age: p.age, gender: p.gender, status: p.status, location: place(p.bed),
        doctor: p.doctor?.name || null, reasonForVisit: p.complaint || null, diagnosis: p.diagnosis || null, allergies: p.allergies || null,
        latestVitals: v ? { recorded: v.createdAt, temperatureC: v.temperature, bp: v.systolic != null ? `${v.systolic}/${v.diastolic}` : null, pulse: v.pulse, spo2: v.spo2, breathingRate: v.respRate, abnormal: Object.entries(vitalFlags(v)).filter(([, x]) => x).map(([k, x]) => `${k}: ${x}`) } : null,
        pendingLabTests: labs.map((l) => `${l.test}${l.urgent ? ' (urgent)' : ''}`),
        recentVisits: visits.map((a) => ({ date: a.date, diagnosis: a.diagnosis })),
      };
    },
  },

  find_patient: {
    roles: ['receptionist', 'admin'],
    decl: { name: 'find_patient', description: 'Find a patient by name or ID. Returns basic administrative details only: status, ward and bed, doctor.', parameters: obj({ query: { type: Type.STRING, description: 'Name or patient ID' } }, ['query']) },
    run: async ({ query }, user) => {
      const rows = await findPatients(user, query, 6);
      return { count: rows.length, patients: rows.map((p) => ({ name: p.name, patientId: p.patientId, age: p.age, gender: p.gender, status: p.status, location: place(p.bed), doctor: p.doctor?.name || null })) };
    },
  },

  get_free_beds: {
    roles: ['doctor', 'receptionist', 'admin'],
    decl: { name: 'get_free_beds', description: 'Free and total beds in each ward, with some free bed labels.' },
    run: async () => {
      const beds = await Bed.find().populate({ path: 'room', select: 'number ward', populate: { path: 'ward', select: 'name type' } }).lean();
      const w = {};
      beds.forEach((b) => {
        const ward = b.room?.ward; if (!ward) return;
        const x = (w[ward.name] ||= { ward: ward.name, type: ward.type, total: 0, free: 0, freeBeds: [] });
        x.total++;
        if (b.status === 'available') { x.free++; if (x.freeBeds.length < 6) x.freeBeds.push(`Room ${b.room.number} · ${b.number}`); }
      });
      const wards = Object.values(w);
      return { totalFree: wards.reduce((s, x) => s + x.free, 0), totalBeds: wards.reduce((s, x) => s + x.total, 0), wards };
    },
  },

  get_doctor_availability: {
    roles: ['receptionist', 'admin'],
    decl: { name: 'get_doctor_availability', description: 'Free appointment time slots of doctors on a date.', parameters: obj({ date: dateProp, doctor_name: { type: Type.STRING, description: 'Optional doctor name or specialization' } }) },
    run: async ({ date, doctor_name }) => {
      const d = dateOr(date);
      const f = { role: 'doctor' };
      if (doctor_name) f.$or = [{ name: rx(doctor_name) }, { specialization: rx(doctor_name) }];
      const docs = await User.find(f).select('name specialization').limit(15).lean();
      const taken = await Appointment.find({ date: d, status: 'scheduled', doctor: { $in: docs.map((x) => x._id) } }).select('doctor time').lean();
      const now = `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;
      return {
        date: d,
        doctors: docs.map((x) => {
          const t = new Set(taken.filter((a) => String(a.doctor) === String(x._id)).map((a) => a.time));
          const free = SLOTS.filter((s) => !t.has(s) && (d > today() || (d === today() && s > now)));
          return { name: x.name, specialization: x.specialization, freeSlotCount: free.length, firstFreeSlots: free.slice(0, 6) };
        }),
      };
    },
  },

  get_today_appointments: {
    roles: ['receptionist', 'admin'],
    decl: { name: 'get_today_appointments', description: 'Scheduled appointments on a date (default today), with who has arrived.', parameters: obj({ date: dateProp }) },
    run: async ({ date }) => {
      const d = dateOr(date);
      const rows = await Appointment.find({ date: d, status: 'scheduled' }).sort('time').limit(40).populate('patient', 'name').populate('doctor', 'name');
      return { date: d, count: rows.length, arrived: rows.filter((a) => a.checkedInAt).length, appointments: rows.map((a) => ({ time: a.time, patient: a.patient?.name, doctor: a.doctor?.name, arrived: !!a.checkedInAt })) };
    },
  },

  get_hospital_stats: {
    roles: ['admin'],
    decl: { name: 'get_hospital_stats', description: 'Overall hospital numbers: patients, bed occupancy, staff, appointments today, pending bills.' },
    run: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const [patients, admitted, beds, freeBeds, doctors, receptionists, regToday, apptToday, dues] = await Promise.all([
        Patient.countDocuments(), Patient.countDocuments({ status: 'admitted' }), Bed.countDocuments(), Bed.countDocuments({ status: 'available' }),
        User.countDocuments({ role: 'doctor' }), User.countDocuments({ role: 'receptionist' }),
        Patient.countDocuments({ createdAt: { $gte: start } }), Appointment.countDocuments({ date: today(), status: 'scheduled' }),
        Bill.aggregate([{ $group: { _id: null, billed: { $sum: '$total' }, paid: { $sum: '$paid' } } }]),
      ]);
      return { patients, admittedNow: admitted, beds, freeBeds, occupancyPercent: beds ? Math.round(((beds - freeBeds) / beds) * 100) : 0, doctors, receptionists, registeredToday: regToday, appointmentsToday: apptToday, pendingDuesRupees: dues[0] ? dues[0].billed - dues[0].paid : 0 };
    },
  },
};

export const declarationsFor = (role) => Object.values(TOOLS).filter((t) => t.roles.includes(role)).map((t) => t.decl);
export const isAllowed = (role, name) => !!TOOLS[name]?.roles.includes(role);
export const runTool = (name, args, user) => TOOLS[name].run(args || {}, user);