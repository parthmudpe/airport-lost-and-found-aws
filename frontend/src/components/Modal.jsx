export default function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-runway-950/50" onClick={onClose} />
      <div className="relative card w-full max-w-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-display text-lg">{title}</h3>
          <button onClick={onClose} className="text-runway-700 hover:text-runway-900 focus-ring rounded" aria-label="Close">✕</button>
        </div>
        <div>{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
