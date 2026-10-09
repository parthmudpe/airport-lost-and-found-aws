import { useEffect, useState } from 'react';
import { Api } from '../../api/client';
import Loading from '../../components/Loading.jsx';
import EmptyState from '../../components/EmptyState.jsx';

export default function AuditLogs() {
  const [result, setResult] = useState(null);
  useEffect(() => { Api.auditLogs({ pageSize: 50 }).then(setResult); }, []);

  if (!result) return <Loading />;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-6">Audit logs</h1>
      {result.items.length === 0 ? <EmptyState title="No activity recorded yet" /> : (
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
              {result.items.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-2 text-xs text-runway-700 whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2">{a.action.replaceAll('_', ' ')}</td>
                  <td className="px-4 py-2 text-xs">{a.entity_type} {a.entity_id ? `#${a.entity_id.slice(0, 8)}` : ''}</td>
                  <td className="px-4 py-2 text-xs">{a.role || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
