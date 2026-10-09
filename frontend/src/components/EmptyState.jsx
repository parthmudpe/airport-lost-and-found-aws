export default function EmptyState({ title, hint, action }) {
  return (
    <div className="text-center py-14 px-6">
      <p className="font-display text-lg text-runway-900">{title}</p>
      {hint && <p className="text-sm text-runway-700 mt-1 max-w-md mx-auto">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
