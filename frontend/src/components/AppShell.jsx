import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Sun, Moon } from 'lucide-react';

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
  
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return (
    <div className="min-h-screen flex bg-mist-50 dark:bg-runway-950 transition-colors duration-200">
      <aside className="w-60 shrink-0 bg-runway-900 text-mist-50 flex flex-col border-r border-runway-800 shadow-xl z-10">
        <div className="px-5 py-5 border-b border-white/10 flex justify-between items-center">
          <div>
            <p className="font-display text-lg font-bold tracking-tight">Skyway</p>
            <p className="text-xs text-mist-200/70">Lost &amp; Found</p>
          </div>
          <button 
            onClick={() => setIsDark(!isDark)}
            className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-mist-200 hover:text-white"
            aria-label="Toggle dark mode"
          >
            {isDark ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-signal-500 text-white shadow-md' : 'text-mist-100/80 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-white/10 text-sm bg-runway-950/30">
          <p className="font-medium truncate text-white">{user?.fullName}</p>
          <p className="text-xs text-mist-200/60 truncate mb-3">{user?.email}</p>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="w-full text-left px-3 py-1.5 text-xs font-semibold text-amber-400 hover:text-white hover:bg-amber-500/20 focus-ring rounded transition-colors"
          >
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto">
        <div className="max-w-5xl w-full mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
