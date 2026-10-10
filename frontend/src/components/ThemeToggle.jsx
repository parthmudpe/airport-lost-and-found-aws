import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(
    () => document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('lf-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  return (
    <button
      type="button"
      onClick={() => setIsDark((current) => !current)}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      aria-pressed={isDark}
      className="inline-flex items-center justify-center gap-2 rounded-lg
        border border-mist-200 bg-white px-3 py-2 text-sm font-semibold
        text-runway-800 shadow-sm transition hover:bg-mist-100
        focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-signal-500 dark:border-slate-600
        dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
    >
      <span aria-hidden="true">{isDark ? '☀' : '☾'}</span>
      {isDark ? 'Light mode' : 'Dark mode'}
    </button>
  );
}