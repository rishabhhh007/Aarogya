import { useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

function Msg({ m }) {
  return m ? <p className={m.ok ? 'ok' : 'err'}>{m.text}</p> : null;
}

export default function Settings() {
  const { user, setUser } = useAuth();
  const [p, setP] = useState({ name: user.name, email: user.email });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pMsg, setPMsg] = useState(null);
  const [pwMsg, setPwMsg] = useState(null);

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.put('/auth/profile', p);
      setUser(data.user);
      setPMsg({ ok: true, text: 'Profile updated' });
    } catch (e) { setPMsg({ ok: false, text: e.response?.data?.message || 'Failed' }); }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (pw.newPassword !== pw.confirm) return setPwMsg({ ok: false, text: 'Passwords do not match' });
    try {
      await api.put('/auth/password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      setPwMsg({ ok: true, text: 'Password changed' });
    } catch (e) { setPwMsg({ ok: false, text: e.response?.data?.message || 'Failed' }); }
  };

  return (
    <div className="row">
      <form className="card form" onSubmit={saveProfile}>
        <h3>Profile</h3>
        <label>Username</label>
        <input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} required />
        <label>Email (used to log in)</label>
        <input type="email" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} required />
        <Msg m={pMsg} />
        <button className="btn">Save changes</button>
      </form>

      <form className="card form" onSubmit={savePassword}>
        <h3>Change password</h3>
        <label>Current password</label>
        <input type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required />
        <label>New password</label>
        <input type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required />
        <label>Confirm new password</label>
        <input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required />
        <Msg m={pwMsg} />
        <button className="btn">Update password</button>
      </form>
    </div>
  );
}