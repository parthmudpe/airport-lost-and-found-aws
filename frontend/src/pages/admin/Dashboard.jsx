import { useEffect, useState } from 'react';
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
  useEffect(() => { Api.adminDashboard().then(setData); }, []);
  if (!data) return <Loading />;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-6">Admin dashboard</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard label="Total users" value={data.totalUsers} />
        <StatCard label="Total lost items" value={data.totalLostItems} />
        <StatCard label="Total found items" value={data.totalFoundItems} />
        <StatCard label="Match rate" value={`${data.matchRate}%`} />
        <StatCard label="Successful returns" value={data.successfulReturns} />
        <StatCard label="Pending cases" value={data.pendingCases} />
      </div>

      <div className="card p-4">
        <p className="font-display font-semibold mb-3">Recent activity</p>
        <div className="divide-y divide-mist-200">
          {data.recentActivity.map((a) => (
            <div key={a.id} className="py-2 text-sm flex items-center justify-between">
              <span>{a.action.replaceAll('_', ' ')} · {a.entity_type}</span>
              <span className="text-xs text-runway-700">{new Date(a.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
