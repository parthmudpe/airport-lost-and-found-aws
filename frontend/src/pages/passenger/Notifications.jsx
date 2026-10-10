import { useCallback, useEffect, useState } from 'react';
import { Api } from '../../api/client';
import Loading from '../../components/Loading.jsx';
import EmptyState from '../../components/EmptyState.jsx';

function getErrorMessage(err, fallback) {
  return (
    err?.response?.data?.error ||
    err?.message ||
    fallback
  );
}

export default function Notifications() {
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markingId, setMarkingId] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await Api.notifications();
      setItems(result);
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'Unable to load notifications. Please try again.'
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function markAsRead(id) {
    if (markingId) return;

    setMarkingId(id);
    setError('');

    try {
      await Api.markNotificationRead(id);

      // Update the local list immediately after the API succeeds.
      setItems((current) =>
        current
          ? current.map((item) =>
              item.id === id
                ? { ...item, is_read: 1 }
                : item
            )
          : current
      );
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'Unable to mark this notification as read.'
        )
      );
    } finally {
      setMarkingId(null);
    }
  }

  if (loading && items === null) {
    return <Loading />;
  }

  if (items === null) {
    return (
      <div className="card p-6">
        <h1 className="font-display text-xl font-bold mb-2">
          Unable to load notifications
        </h1>

        <p role="alert" className="text-sm text-red-600 mb-4">
          {error || 'Something went wrong while loading notifications.'}
        </p>

        <button
          type="button"
          className="btn-primary"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? 'Retrying...' : 'Try again'}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-2xl font-bold">
          Notifications
        </h1>

        <button
          type="button"
          className="btn-secondary"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="card p-4 mb-4">
          <p role="alert" className="text-sm text-red-600 mb-3">
            {error}
          </p>

          <button
            type="button"
            className="btn-secondary"
            onClick={refresh}
            disabled={loading || markingId !== null}
          >
            Try again
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          title="You're all caught up"
          hint="We'll let you know as soon as there's an update on your reports."
        />
      ) : (
        <div className="card divide-y divide-mist-200">
          {items.map((item) => (
            <div
              key={item.id}
              className={`px-4 py-3 flex items-start justify-between gap-4 ${
                item.is_read ? '' : 'bg-signal-500/5'
              }`}
            >
              <div>
                <p className="font-medium text-sm">
                  {item.title}
                </p>

                <p className="text-sm text-runway-700 mt-0.5">
                  {item.message}
                </p>

                <p className="text-xs text-runway-700 mt-1">
                  {new Date(item.created_at).toLocaleString()}
                </p>
              </div>

              {!item.is_read && (
                <button
                  type="button"
                  className="btn-ghost text-xs shrink-0"
                  onClick={() => markAsRead(item.id)}
                  disabled={markingId !== null || loading}
                >
                  {markingId === item.id
                    ? 'Marking...'
                    : 'Mark read'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}