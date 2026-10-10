import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

const HOME = {
  PASSENGER: '/passenger',
  STAFF: '/staff',
  ADMIN: '/admin',
};

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
      setError(
        err.response?.data?.error ||
          'Could not log in. Check your details.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-mist-50 px-4 py-20 dark:bg-slate-950">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <p className="font-display text-2xl font-extrabold tracking-tight text-runway-900 dark:text-slate-100">
            Skyway Lost &amp; Found
          </p>

          <p className="mt-2 text-sm text-runway-700 dark:text-slate-400">
            Sign in to your account
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="card space-y-5 rounded-2xl p-6 shadow-lg sm:p-8"
        >
          <div>
            <h1 className="text-lg font-bold text-runway-900 dark:text-slate-100">
              Welcome back
            </h1>
            <p className="mt-1 text-sm text-runway-700 dark:text-slate-400">
              Enter your account details to continue.
            </p>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
            >
              {error}
            </p>
          )}

          <div>
            <label className="label" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="input"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value })
              }
            />
          </div>

          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="input"
              placeholder="Enter your password"
              value={form.password}
              onChange={(e) =>
                setForm({ ...form, password: e.target.value })
              }
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full justify-center rounded-lg py-3"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-runway-700 dark:text-slate-400">
          New passenger?{' '}
          <Link
            to="/register"
            className="font-semibold text-signal-600 hover:underline dark:text-teal-400"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
