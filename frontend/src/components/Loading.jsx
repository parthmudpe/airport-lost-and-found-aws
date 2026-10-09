export default function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex items-center gap-2 text-sm text-runway-700 py-10 justify-center">
      <span className="h-4 w-4 rounded-full border-2 border-signal-500 border-t-transparent animate-spin" />
      {label}
    </div>
  );
}
