import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import api from '../api';

const C = { blue: '#1f6fb2', green: '#2e8b57', red: '#c0392b', amber: '#d99a2b', teal: '#0f8b8d', grey: '#9aa8b6' };
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const short = (s) => new Date(`${s}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const STATUS_COLOR = { admitted: C.red, outpatient: C.amber, discharged: C.grey };
const METHOD_COLOR = { cash: C.green, upi: C.blue, card: C.amber };

function Kpi({ icon, label, value, accent }) {
  return (
    <div className={`card accent-${accent}`}>
      <h3><span className="icon">{icon}</span>{label}</h3>
      <p className="big" style={{ fontSize: 30 }}>{value}</p>
    </div>
  );
}

const Chart = ({ title, children, height = 270 }) => (
  <div className="card chart-card">
    <h3>{title}</h3>
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>{children}</ResponsiveContainer>
    </div>
  </div>
);

export default function Reports() {
  const [days, setDays] = useState(30);
  const [d, setD] = useState(null);

  useEffect(() => { setD(null); api.get('/reports/summary', { params: { days } }).then((r) => setD(r.data)); }, [days]);

  if (!d) return <p className="muted">Loading reports...</p>;
  const k = d.kpi;
  const tick = { fontSize: 12, fill: '#6b7a8c' };

  return (
    <div>
      <div className="toolbar">
        <div className="tabs" style={{ margin: 0 }}>
          {[7, 30, 90].map((n) => <button key={n} className={`tab ${days === n ? 'on' : ''}`} onClick={() => setDays(n)}>Last {n} days</button>)}
        </div>
      </div>

      <section className="row">
        <Kpi icon="🧑‍🤝‍🧑" label="Total patients" value={k.patients} accent="indigo" />
        <Kpi icon="🏥" label="Admitted now" value={k.admitted} accent="red" />
        <Kpi icon="🛏️" label="Bed occupancy" value={`${k.occupancy}%`} accent="amber" />
        <Kpi icon="💰" label={`Collected (${days}d)`} value={inr(k.collected)} accent="green" />
        <Kpi icon="⏳" label="Pending dues" value={inr(k.pending)} accent="pink" />
        <Kpi icon="📅" label={`Appointments (${days}d)`} value={k.appointments} accent="teal" />
      </section>

      <div className="charts">
        <Chart title="Admissions vs discharges">
          <LineChart data={d.trend} margin={{ left: -20, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e6eef5" />
            <XAxis dataKey="date" tickFormatter={short} tick={tick} minTickGap={24} />
            <YAxis allowDecimals={false} tick={tick} />
            <Tooltip labelFormatter={short} />
            <Legend />
            <Line type="monotone" dataKey="admissions" name="Admissions" stroke={C.blue} strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="discharges" name="Discharges" stroke={C.green} strokeWidth={2.5} dot={false} />
          </LineChart>
        </Chart>

        <Chart title="Revenue collected (₹)">
          <AreaChart data={d.trend} margin={{ left: -10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e6eef5" />
            <XAxis dataKey="date" tickFormatter={short} tick={tick} minTickGap={24} />
            <YAxis tick={tick} />
            <Tooltip labelFormatter={short} formatter={(v) => inr(v)} />
            <Area type="monotone" dataKey="revenue" name="Revenue" stroke={C.green} fill="#bfe3cf" strokeWidth={2} />
          </AreaChart>
        </Chart>

        <Chart title="Bed occupancy by ward">
          <BarChart data={d.wards} margin={{ left: -20, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e6eef5" />
            <XAxis dataKey="name" tick={tick} />
            <YAxis allowDecimals={false} tick={tick} />
            <Tooltip />
            <Legend />
            <Bar dataKey="occupied" name="Occupied" stackId="a" fill={C.red} />
            <Bar dataKey="available" name="Available" stackId="a" fill={C.green} radius={[6, 6, 0, 0]} />
          </BarChart>
        </Chart>

        <Chart title="Patients by status">
          <PieChart>
            <Pie data={d.status} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={3}>
              {d.status.map((s) => <Cell key={s.name} fill={STATUS_COLOR[s.name]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </Chart>

        <Chart title="Patients by department">
          <BarChart data={d.departments} layout="vertical" margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e6eef5" />
            <XAxis type="number" allowDecimals={false} tick={tick} />
            <YAxis type="category" dataKey="name" width={110} tick={tick} />
            <Tooltip />
            <Bar dataKey="value" name="Patients" fill={C.blue} radius={[0, 6, 6, 0]} />
          </BarChart>
        </Chart>

        <Chart title="Appointments per doctor">
          <BarChart data={d.doctors} margin={{ left: -20, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e6eef5" />
            <XAxis dataKey="name" tick={tick} />
            <YAxis allowDecimals={false} tick={tick} />
            <Tooltip />
            <Legend />
            <Bar dataKey="completed" name="Completed" stackId="a" fill={C.green} />
            <Bar dataKey="scheduled" name="Scheduled" stackId="a" fill={C.blue} />
            <Bar dataKey="cancelled" name="Cancelled" stackId="a" fill={C.red} radius={[6, 6, 0, 0]} />
          </BarChart>
        </Chart>

        <Chart title="Payments by method">
          <PieChart>
            <Pie data={d.methods} dataKey="value" nameKey="name" outerRadius={95} label={(e) => (e.value ? e.name.toUpperCase() : '')}>
              {d.methods.map((m) => <Cell key={m.name} fill={METHOD_COLOR[m.name]} />)}
            </Pie>
            <Tooltip formatter={(v) => inr(v)} />
          </PieChart>
        </Chart>
      </div>
    </div>
  );
}