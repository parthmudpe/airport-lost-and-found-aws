import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Api } from '../../api/client';
import Loading from '../../components/Loading.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import EmptyState from '../../components/EmptyState.jsx';

function StatCard({ label, value }) {
  return (
    <div className="card p-4">
      <p className="text-2xl font-display font-bold">{value}</p>
      <p className="text-sm text-runway-700 mt-1">{label}</p>
    </div>
  );
}

export default function PassengerDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => { Api.passengerDashboard().then(setData); }, []);

  if (!data) return <Loading />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Your dashboard</h1>
        <Link to="/passenger/report" className="btn-primary">Report a lost item</Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
        <StatCard label="Active reports" value={data.activeReports} />
        <StatCard label="Possible matches" value={data.possibleMatches} />
        <StatCard label="Under verification" value={data.underVerification} />
        <StatCard label="Ready / confirmed" value={data.readyForCollection} />
        <StatCard label="Returned" value={data.returnedItems} />
      </div>

      <h2 className="font-display text-lg font-semibold mb-3">Recent reports</h2>
      {data.reports.length === 0 ? (
        <EmptyState title="No reports yet" hint="Lost something at the airport? Report it and we'll start looking."
          action={<Link to="/passenger/report" className="btn-primary">Report a lost item</Link>} />
      ) : (
        <div className="card divide-y divide-mist-200">
          {data.reports.slice(0, 6).map((r) => (
            <Link key={r.id} to="/passenger/reports" className="flex items-center justify-between px-4 py-3 hover:bg-mist-50">
              <div>
                <p className="font-medium">{r.item_name}</p>
                <p className="text-xs text-runway-700">{r.report_number} · Lost {r.date_lost}</p>
              </div>
              <StatusBadge status={r.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
