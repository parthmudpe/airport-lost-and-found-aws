
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const HOME = { PASSENGER: '/passenger', STAFF: '/staff', ADMIN: '/admin' };

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(form.email, form.password);
      navigate(HOME[user.role] || '/');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not log in. Check your details.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-mist-50 px-4">
      <div className="w-full max-w-sm">
        <p className="font-display text-xl font-bold text-center mb-1">
          Skyway Lost &amp; Found
        </p>
        <p className="text-center text-sm text-runway-700 mb-6">
          Sign in to your account
        </p>

        <form onSubmit={onSubmit} className="card p-6 space-y-4">
          {error && (
            <p className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              className="input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm text-runway-700 mt-4">
          New passenger?{' '}
          <Link to="/register" className="text-signal-600 font-medium">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
