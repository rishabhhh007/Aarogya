export const SHIFTS = {
  morning: { label: 'Morning', time: '8:00 AM – 2:00 PM', icon: '🌅' },
  evening: { label: 'Evening', time: '2:00 PM – 8:00 PM', icon: '🌇' },
  night: { label: 'Night', time: '8:00 PM – 8:00 AM', icon: '🌙' },
};
export const ORDER = ['morning', 'evening', 'night'];
const pad = (n) => String(n).padStart(2, '0');
export const toStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (s, n) => { const d = new Date(`${s}T00:00:00`); d.setDate(d.getDate() + n); return toStr(d); };
export const pretty = (s) => new Date(`${s}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
export const sortDuties = (a, b) => a.date.localeCompare(b.date) || ORDER.indexOf(a.shift) - ORDER.indexOf(b.shift);