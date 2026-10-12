export const to12 = (t) => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const esc = (s = '') => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;

const STYLE = `body{font-family:Arial,sans-serif;max-width:560px;margin:24px auto;color:#1f2d3d}
h1{margin:0;color:#1f6fb2;font-size:24px}.sub{color:#6b7a8c;font-size:13px;margin-bottom:14px}
hr{border:0;border-top:2px solid #1f6fb2;margin:10px 0 16px}td,th{padding:6px 8px;text-align:left;font-size:14px;vertical-align:top}
th{color:#6b7a8c;font-weight:600;width:130px}.token{font-size:56px;font-weight:700;color:#1f6fb2;text-align:center;margin:10px 0}
table.rx{width:100%;border-collapse:collapse}table.rx th,table.rx td{border-bottom:1px solid #dde7f0;width:auto}
.foot{margin-top:40px;font-size:12px;color:#6b7a8c}.sign{margin-top:50px;text-align:right}`;

function openPrint(title, body) {
  const w = window.open('', '_blank', 'width=720,height=800');
  if (!w) return alert('Please allow pop-ups to print');
  w.document.write(`<html><head><title>${esc(title)}</title><style>${STYLE}</style></head><body>
    <h1>Aarogya Hospital</h1><div class="sub">${esc(title)}</div><hr/>${body}</body></html>`);
  w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
}

/* ---------- Invoice (used by Billing) ---------- */
export function printInvoice(b) {
  const subtotal = b.items.reduce((s, i) => s + i.qty * i.price, 0);
  const rows = b.items.map((i, n) =>
    `<tr><td>${n + 1}</td><td>${esc(i.description)}</td><td>${esc(i.qty)}</td><td>${inr(i.price)}</td><td>${inr(i.qty * i.price)}</td></tr>`).join('');
  const pays = (b.payments || []).map((p) =>
    `<tr><td>${new Date(p.date).toLocaleDateString()}</td><td>${esc(p.method.toUpperCase())}</td><td>${inr(p.amount)}</td></tr>`).join('');
  openPrint(`Invoice ${b.billNo}`, `
    <table>
      <tr><th>Patient</th><td>${esc(b.patient?.name)} (${esc(b.patient?.patientId)})</td></tr>
      <tr><th>Bill date</th><td>${new Date(b.createdAt).toLocaleDateString()}</td></tr>
    </table>
    <table class="rx" style="margin-top:14px"><tr><th>#</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>${rows}</table>
    <table style="margin-top:10px;margin-left:auto;width:260px">
      <tr><th>Subtotal</th><td>${inr(subtotal)}</td></tr>
      <tr><th>Discount</th><td>- ${inr(b.discount)}</td></tr>
      <tr><th>Total</th><td><b>${inr(b.total)}</b></td></tr>
      <tr><th>Paid</th><td>${inr(b.paid)}</td></tr>
      <tr><th>Balance</th><td><b>${inr(b.total - b.paid)}</b></td></tr>
    </table>
    ${pays ? `<h3>Payments</h3><table class="rx"><tr><th>Date</th><th>Method</th><th>Amount</th></tr>${pays}</table>` : ''}
    <div class="foot">This is a computer-generated invoice. Thank you for choosing Aarogya.</div>`);
}

/* ---------- Appointment slip and prescription (used by the doctor/receptionist round, later) ---------- */
export function printSlip(a) {
  openPrint('Appointment slip', `
    ${a.token ? `<div class="token">Token #${esc(a.token)}</div>` : ''}
    <table>
      <tr><th>Patient</th><td>${esc(a.patient?.name)} (${esc(a.patient?.patientId)})</td></tr>
      <tr><th>Doctor</th><td>${esc(a.doctor?.name)} - ${esc(a.doctor?.specialization)}</td></tr>
      <tr><th>Date</th><td>${esc(a.date)}</td></tr>
      <tr><th>Time</th><td>${esc(to12(a.time))}</td></tr>
      ${a.reason ? `<tr><th>Reason</th><td>${esc(a.reason)}</td></tr>` : ''}
    </table>
    <div class="foot">Please arrive 10 minutes early and show this slip at the reception.</div>`);
}

export function printPrescription(a) {
  const rows = (a.prescriptions || []).filter((m) => m.medicine).map((m, i) =>
    `<tr><td>${i + 1}</td><td><b>${esc(m.medicine)}</b></td><td>${esc(m.dose)}</td><td>${esc(m.duration)}</td><td>${esc(m.instructions)}</td></tr>`).join('');
  openPrint('Prescription', `
    <table>
      <tr><th>Patient</th><td>${esc(a.patient?.name)} (${esc(a.patient?.patientId)}), ${esc(a.patient?.age)} / ${esc(a.patient?.gender)}</td></tr>
      <tr><th>Date</th><td>${esc(a.date)}</td></tr>
      ${a.patient?.allergies ? `<tr><th>Allergies</th><td>${esc(a.patient.allergies)}</td></tr>` : ''}
      <tr><th>Diagnosis</th><td>${esc(a.diagnosis)}</td></tr>
    </table>
    <h3>Rx</h3>
    <table class="rx"><tr><th>#</th><th>Medicine</th><th>Dose</th><th>Duration</th><th>Instructions</th></tr>${rows || '<tr><td colspan="5">No medicines</td></tr>'}</table>
    ${a.plan ? `<p><b>Advice:</b> ${esc(a.plan)}</p>` : ''}
    <div class="sign">${esc(a.doctor?.name)}<br/>${esc(a.doctor?.specialization)}</div>`);
}