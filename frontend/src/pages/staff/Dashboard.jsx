import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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

export default function StaffDashboard() {
  const [data, setData] = useState(null);
  useEffect(() => { Api.staffDashboard().then(setData); }, []);
  if (!data) return <Loading />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Staff dashboard</h1>
        <Link to="/staff/register-found" className="btn-primary">Register found item</Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard label="Total lost reports" value={data.totalLostReports} />
        <StatCard label="Total found items" value={data.totalFoundItems} />
        <StatCard label="Possible matches" value={data.possibleMatches} />
        <StatCard label="Pending ownership" value={data.pendingOwnershipVerification} />
        <StatCard label="Items returned" value={data.itemsReturned} />
        <StatCard label="Unclaimed" value={data.unclaimedItems} />
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <div className="card p-4">
          <p className="font-display font-semibold mb-3">Lost reports by status</p>
          <StatusList map={data.lostByStatus} />
        </div>
        <div className="card p-4">
          <p className="font-display font-semibold mb-3">Found items by status</p>
          <StatusList map={data.foundByStatus} />
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <Link to="/staff/matches" className="btn-secondary">Review possible matches →</Link>
        <Link to="/staff/lost-items" className="btn-secondary">Search lost reports →</Link>
        <Link to="/staff/found-items" className="btn-secondary">Search found items →</Link>
      </div>
    </div>
  );
}

function StatusList({ map }) {
  const entries = Object.entries(map || {});
  if (entries.length === 0) return <p className="text-sm text-runway-700">No data yet.</p>;
  const max = Math.max(...entries.map(([, v]) => v));
  return (
    <div className="space-y-2">
      {entries.map(([status, count]) => (
        <div key={status} className="flex items-center gap-3 text-sm">
          <span className="w-40 shrink-0 text-runway-700">{status.replaceAll('_', ' ')}</span>
          <div className="flex-1 bg-mist-100 rounded h-2">
            <div className="bg-signal-500 h-2 rounded" style={{ width: `${(count / max) * 100}%` }} />
          </div>
          <span className="w-6 text-right font-medium">{count}</span>
        </div>
      ))}
    </div>
  );
}
