import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ChatWidget from './ChatWidget';

const ALL = ['admin', 'doctor', 'receptionist'];
const NAV = [
  { to: '/', label: 'Dashboard', icon: '📊', roles: ALL, end: true },
  { to: '/patients', label: 'Patients', icon: '🧑‍🤝‍🧑', roles: ALL },
  { to: '/priority', label: 'Priority Patients', icon: '🚨', roles: ['admin', 'doctor'] },
  { to: '/duty', label: 'My Duty', icon: '🗓️', roles: ['doctor'] },
  { to: '/roster', label: 'Duty Roster', icon: '📋', roles: ['admin'] },
  { to: '/labs', label: 'Lab Tests', icon: '🧪', roles: ['admin', 'doctor'] },
  { to: '/appointments', label: 'Appointments', icon: '📅', roles: ALL },
  { to: '/doctors', label: 'Doctors', icon: '🩺', roles: ['admin'] },
  { to: '/receptionists', label: 'Receptionists', icon: '🧑‍💼', roles: ['admin'] },
  { to: '/infrastructure', label: 'Wards, Rooms & Beds', icon: '🛏️', roles: ['admin'] },
  { to: '/billing', label: 'Billing', icon: '💳', roles: ['admin', 'receptionist'] },
  { to: '/reports', label: 'Reports', icon: '📈', roles: ['admin'] },
  { to: '/settings', label: 'Settings', icon: '⚙️', roles: ALL },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const items = NAV.filter((n) => n.roles.includes(user.role));
  const title = items.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)))?.label || 'Dashboard';

  return (
    <div className="app">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand"><span>🏥</span>Aarogya</div>
        <nav>
          {items.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="nav-icon">{n.icon}</span>{n.label}
            </NavLink>
          ))}
        </nav>
        <button className="nav-item logout" onClick={logout}><span className="nav-icon">🚪</span>Logout</button>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}

      <div className="main">
        <div className="topbar">
          <button className="burger" onClick={() => setOpen(true)}>☰</button>
          <div className="tb-title">
            <h2>{title}</h2>
            <small>{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</small>
          </div>
          <ChatWidget />
          <div className="user-chip">
            <span className="avatar">{user.name?.[0]?.toUpperCase()}</span>
            <div><b>{user.name}</b><small>{user.role}</small></div>
          </div>
        </div>
        <div className="content"><Outlet /></div>
      </div>
    </div>
  );
}