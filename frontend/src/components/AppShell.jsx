import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import ThemeToggle from './ThemeToggle.jsx';

const NAV = {
  PASSENGER: [
    { to: '/passenger', label: 'Dashboard', end: true },
    { to: '/passenger/report', label: 'Report lost item' },
    { to: '/passenger/reports', label: 'My reports' },
    { to: '/passenger/notifications', label: 'Notifications' },
  ],
  STAFF: [
    { to: '/staff', label: 'Dashboard', end: true },
    { to: '/staff/lost-items', label: 'Lost items' },
    { to: '/staff/found-items', label: 'Found items' },
    { to: '/staff/register-found', label: 'Register found item' },
    { to: '/staff/matches', label: 'Match review' },
  ],
  ADMIN: [
    { to: '/admin', label: 'Dashboard', end: true },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/audit-logs', label: 'Audit logs' },
  ],
};

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = NAV[user?.role] || [];
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-mist-50 md:flex">
      {menuOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 bg-runway-950/60 md:hidden"
        />
      )}

      <aside
        className={`${
          menuOpen ? 'flex' : 'hidden'
        } fixed inset-y-0 left-0 z-40 w-64 shrink-0 flex-col
          bg-runway-900 text-mist-50 shadow-xl
          md:static md:flex md:h-screen md:shadow-none`}
      >
        <div className="border-b border-white/10 px-5 py-6">
          <p className="font-display text-xl font-extrabold tracking-tight">
            Skyway
          </p>
          <p className="mt-1 text-xs tracking-wide text-mist-200/70">
            AIRPORT LOST &amp; FOUND
          </p>
        </div>

        <nav
          aria-label="Main navigation"
          className="flex-1 space-y-1 overflow-y-auto px-3 py-5"
        >
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-mist-200/50">
            Workspace
          </p>

          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-signal-500 text-white shadow-sm'
                    : 'text-mist-100/80 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="mb-3 rounded-lg bg-white/5 p-3">
            <p className="truncate text-sm font-semibold">
              {user?.fullName}
            </p>
            <p className="mt-1 truncate text-xs text-mist-200/60">
              {user?.email}
            </p>
            <p className="mt-2 inline-flex rounded-full bg-white/10 px-2 py-1 text-xs font-semibold">
              {user?.role}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold
              text-amber-400 transition hover:bg-white/10 hover:text-amber-300
              focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-amber-400"
          >
            Log out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header
          className="sticky top-0 z-20 flex min-h-16 items-center justify-between
            gap-3 border-b border-mist-200 bg-white/90 px-4 py-3
            backdrop-blur-md sm:px-6 dark:border-slate-700
            dark:bg-slate-900/90"
        >
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              className="rounded-lg border border-mist-200 px-3 py-2
                text-sm font-semibold text-runway-800 hover:bg-mist-100
                md:hidden dark:border-slate-600 dark:text-slate-100
                dark:hover:bg-slate-800"
            >
              {menuOpen ? 'Close' : 'Menu'}
            </button>

            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-runway-900 dark:text-slate-100">
                {user?.role === 'PASSENGER'
                  ? 'Passenger portal'
                  : user?.role === 'STAFF'
                    ? 'Airport staff portal'
                    : 'Administration portal'}
              </p>
              <p className="hidden text-xs text-runway-700 sm:block dark:text-slate-400">
                Lost &amp; Found Management System
              </p>
            </div>
          </div>

          <ThemeToggle />
        </header>

        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}