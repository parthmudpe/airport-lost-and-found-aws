import { useCallback, useEffect, useState } from 'react';
import { Api } from '../../api/client';
import Loading from '../../components/Loading.jsx';

function StatCard({ label, value }) {
  return (
    <div className="card p-4">
      <p className="text-2xl font-display font-bold">{value}</p>
      <p className="text-sm text-runway-700 mt-1">{label}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await Api.adminDashboard();
      setData(result);
    } catch (err) {
      setError(
        err?.message ||
        'Unable to load the admin dashboard. Check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading && !data) {
    return <Loading />;
  }

  if (error && !data) {
    return (
      <div className="card p-6">
        <h1 className="font-display text-xl font-bold mb-2">
          Unable to load admin dashboard
        </h1>

        <p role="alert" className="text-sm text-red-600 mb-4">
          {error}
        </p>

        <button
          type="button"
          className="btn-primary"
          onClick={loadDashboard}
          disabled={loading}
        >
          {loading ? 'Retrying...' : 'Try again'}
        </button>
      </div>
    );
  }

  if (!data) {
    return <Loading />;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-2xl font-bold">
          Admin dashboard
        </h1>

        <button
          type="button"
          className="btn-secondary"
          onClick={loadDashboard}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="card p-4 mb-6">
          <p role="alert" className="text-sm text-red-600">
            Refresh failed: {error}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard
          label="Total users"
          value={data.totalUsers}
        />

        <StatCard
          label="Total lost items"
          value={data.totalLostItems}
        />

        <StatCard
          label="Total found items"
          value={data.totalFoundItems}
        />

        <StatCard
          label="Match rate"
          value={`${data.matchRate}%`}
        />

        <StatCard
          label="Successful returns"
          value={data.successfulReturns}
        />

        <StatCard
          label="Pending cases"
          value={data.pendingCases}
        />
      </div>

      <div className="card p-4">
        <p className="font-display font-semibold mb-3">
          Recent activity
        </p>

        {data.recentActivity.length === 0 ? (
          <p className="text-sm text-runway-700">
            No recent activity.
          </p>
        ) : (
          <div className="divide-y divide-mist-200">
            {data.recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="py-2 text-sm flex flex-wrap items-center justify-between gap-2"
              >
                <span>
                  {activity.action.replaceAll('_', ' ')}
                  {' · '}
                  {activity.entity_type}
                </span>

                <span className="text-xs text-runway-700">
                  {new Date(activity.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}