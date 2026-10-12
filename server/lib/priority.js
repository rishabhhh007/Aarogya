// Which vitals are abnormal. Returns 'critical' | 'warn' | null for each measurement.
const lvl = (crit, warn) => (crit ? 'critical' : warn ? 'warn' : null);

export function vitalFlags(v) {
  const f = {};
  if (!v) return f;
  const { temperature: t, systolic: s, diastolic: d, pulse: p, spo2: o, respRate: r } = v;
  if (t != null) f.temperature = lvl(t >= 39.5 || t < 35, t >= 38 || t < 35.5);
  if (s != null && d != null) f.bp = lvl(s >= 180 || d >= 120 || s < 90, s >= 140 || d >= 90 || s < 100);
  if (p != null) f.pulse = lvl(p > 130 || p < 45, p > 100 || p < 55);
  if (o != null) f.spo2 = lvl(o < 90, o < 94);
  if (r != null) f.respRate = lvl(r > 30 || r < 10, r > 24 || r < 12);
  return f;
}

// points for [critical, abnormal]
const WEIGHT = { spo2: [35, 15], temperature: [20, 8], bp: [25, 10], pulse: [20, 8], respRate: [15, 6] };

export function assess(patient, latest, { wardType, urgentLab } = {}) {
  let pts = 0;
  const reasons = [];
  const f = vitalFlags(latest);
  const text = {
    temperature: `Temperature ${latest?.temperature}°C`, bp: `BP ${latest?.systolic}/${latest?.diastolic}`,
    pulse: `Pulse ${latest?.pulse} bpm`, spo2: `SpO2 ${latest?.spo2}%`, respRate: `Breathing ${latest?.respRate}/min`,
  };
  for (const k in f) {
    if (!f[k]) continue;
    pts += WEIGHT[k][f[k] === 'critical' ? 0 : 1];
    reasons.push(`${text[k]} (${f[k] === 'critical' ? 'critical' : 'abnormal'})`);
  }
  if (!latest) { pts += 5; reasons.push('No vitals recorded'); }
  else if (Date.now() - new Date(latest.createdAt) > 12 * 3600e3) { pts += 5; reasons.push('Vitals older than 12 hours'); }
  if (patient.age != null && (patient.age >= 70 || patient.age <= 5)) { pts += 10; reasons.push(patient.age >= 70 ? 'Elderly patient' : 'Young child'); }
  if (['ICU', 'Emergency'].includes(wardType)) { pts += 10; reasons.push(`${wardType} ward`); }
  if (urgentLab) { pts += 10; reasons.push('Urgent lab result pending'); }
  const level = pts >= 50 ? 'critical' : pts >= 25 ? 'high' : pts >= 10 ? 'medium' : 'stable';
  return { score: pts, level, reasons };
}