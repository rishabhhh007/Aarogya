import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    try { await login(f.email, f.password); nav('/'); }
    catch (e) { setErr(e.response?.data?.message || 'Login failed'); }
  };

  return (
    <div className="login-wrap">
      <div className="login-brand">Aarogya</div>
      <main className="login-content">
        <div className="login-intro">
          <span className="login-kicker">YOUR HOSPITAL, IN SYNC</span>
          <p>Sign in to manage your day and support better patient care.</p>
        </div>
        <form className="card login" onSubmit={submit}>
          <h2>Welcome back</h2>
          <p className="login-subtitle">Sign in to your Aarogya workspace</p>
          {err && <p className="err" role="alert">{err}</p>}
          <label htmlFor="login-email">Email address</label>
          <input id="login-email" placeholder="Enter your email" type="email" autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
          <label htmlFor="login-password">Password</label>
          <input id="login-password" placeholder="Enter your password" type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
          <button className="btn">Sign in</button>
        </form>
        <p className="login-footer">A calmer, clearer way to coordinate care.</p>
      </main>
    </div>
  );
}
