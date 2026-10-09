import { useEffect, useState } from 'react';
import { Api } from '../../api/client';
import Loading from '../../components/Loading.jsx';
import EmptyState from '../../components/EmptyState.jsx';

export default function Notifications() {
  const [items, setItems] = useState(null);

  async function refresh() {
    setItems(await Api.notifications());
  }
  useEffect(() => { refresh(); }, []);

  if (!items) return <Loading />;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-6">Notifications</h1>
      {items.length === 0 ? (
        <EmptyState title="You're all caught up" hint="We'll let you know as soon as there's an update on your reports." />
      ) : (
        <div className="card divide-y divide-mist-200">
          {items.map((n) => (
            <div key={n.id} className={`px-4 py-3 flex items-start justify-between gap-4 ${n.is_read ? '' : 'bg-signal-500/5'}`}>
              <div>
                <p className="font-medium text-sm">{n.title}</p>
                <p className="text-sm text-runway-700 mt-0.5">{n.message}</p>
                <p className="text-xs text-runway-700 mt-1">{new Date(n.created_at).toLocaleString()}</p>
              </div>
              {!n.is_read && (
                <button className="btn-ghost text-xs shrink-0" onClick={async () => { await Api.markNotificationRead(n.id); refresh(); }}>
                  Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
