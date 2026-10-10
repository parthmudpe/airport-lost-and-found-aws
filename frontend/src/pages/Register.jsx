import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', fullName: '', phone: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(form);
      navigate('/passenger');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create your account.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-mist-50 dark:bg-runway-950 px-4 transition-colors duration-200">
      <div className="w-full max-w-sm">
        <p className="font-display text-xl font-bold text-center mb-1 text-runway-900 dark:text-mist-50">Skyway Lost &amp; Found</p>
        <p className="text-center text-sm text-runway-700 dark:text-mist-400 mb-6">Create a passenger account</p>
        <form onSubmit={onSubmit} className="card p-6 space-y-4">
          {error && <p className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 rounded-md px-3 py-2">{error}</p>}
          <div>
            <label className="label" htmlFor="fullName">Full name</label>
            <input id="fullName" required className="input" value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" required className="input" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="phone">Phone (optional)</label>
            <input id="phone" className="input" value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" minLength={8} required className="input" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <p className="text-xs text-runway-700 dark:text-mist-400 mt-1">At least 8 characters.</p>
          </div>
          <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? 'Creating account…' : 'Create account'}</button>
        </form>
        <p className="text-center text-sm text-runway-700 dark:text-mist-400 mt-4">
          Already have an account? <Link to="/login" className="text-signal-600 dark:text-signal-400 hover:text-signal-500 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
