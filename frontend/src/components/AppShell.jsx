import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

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

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 bg-runway-900 text-mist-50 flex flex-col">
        <div className="px-5 py-5 border-b border-white/10">
          <p className="font-display text-lg font-bold tracking-tight">Skyway</p>
          <p className="text-xs text-mist-200/70">Lost &amp; Found</p>
        </div>
        <nav className="flex-1 py-4 px-2 space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-signal-500 text-white' : 'text-mist-100/80 hover:bg-white/10'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-white/10 text-sm">
          <p className="font-medium truncate">{user?.fullName}</p>
          <p className="text-xs text-mist-200/60 truncate">{user?.email}</p>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="mt-3 text-xs font-semibold text-amber-400 hover:text-amber-500 focus-ring rounded"
          >
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 bg-mist-50">
        <div className="max-w-5xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
