import { useCallback, useEffect, useState } from 'react';
import { Api } from '../../api/client';
import Loading from '../../components/Loading.jsx';
import EmptyState from '../../components/EmptyState.jsx';

function getErrorMessage(err) {
  return (
    err?.response?.data?.error ||
    err?.message ||
    'Unable to load audit logs. Please try again.'
  );
}

export default function AuditLogs() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await Api.auditLogs({ pageSize: 50 });
      setResult(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs, retryKey]);

  function retry() {
    setRetryKey((key) => key + 1);
  }

  if (loading && result === null) {
    return <Loading />;
  }

  if (result === null) {
    return (
      <div className="card p-6">
        <h1 className="font-display text-xl font-bold mb-2">
          Unable to load audit logs
        </h1>

        <p role="alert" className="text-sm text-red-600 mb-4">
          {error || 'Something went wrong while loading the audit logs.'}
        </p>

        <button
          type="button"
          className="btn-primary"
          onClick={retry}
          disabled={loading}
        >
          {loading ? 'Retrying...' : 'Try again'}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="font-display text-2xl font-bold">
          Audit logs
        </h1>

        <button
          type="button"
          className="btn-secondary"
          onClick={retry}
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
            onClick={retry}
            disabled={loading}
          >
            Try again
          </button>
        </div>
      )}

      {loading && (
        <p className="text-sm text-runway-700 mb-3">
          Refreshing audit logs...
        </p>
      )}

      {result.items.length === 0 ? (
        <EmptyState title="No activity recorded yet" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-runway-700 border-b border-mist-200">
              <tr>
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Action</th>
                <th className="px-4 py-2">Entity</th>
                <th className="px-4 py-2">Role</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-mist-200">
              {result.items.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-2 text-xs text-runway-700 whitespace-nowrap">
                    {new Date(entry.created_at).toLocaleString()}
                  </td>

                  <td className="px-4 py-2">
                    {entry.action.replaceAll('_', ' ')}
                  </td>

                  <td className="px-4 py-2 text-xs">
                    {entry.entity_type}
                    {entry.entity_id
                      ? ` #${entry.entity_id.slice(0, 8)}`
                      : ''}
                  </td>

                  <td className="px-4 py-2 text-xs">
                    {entry.role || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}