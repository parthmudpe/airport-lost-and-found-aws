import { useEffect, useState } from 'react';
import { Api } from '../../api/client';
import Loading from '../../components/Loading.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { Pagination } from './LostItems.jsx';

const STATUSES = ['FOUND', 'IN_STORAGE', 'POSSIBLE_MATCH', 'CLAIM_PENDING', 'OWNERSHIP_VERIFICATION', 'RETURNED', 'UNCLAIMED', 'CLOSED'];

export default function FoundItems() {
  const [filters, setFilters] = useState({ category: '', status: '', q: '' });
  const [result, setResult] = useState(null);
  const [page, setPage] = useState(1);

  async function search() {
    setResult(await Api.searchFoundItems({ ...filters, page, pageSize: 15 }));
  }
  useEffect(() => { search(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  function onFilterSubmit(e) {
    e.preventDefault();
    setPage(1);
    search();
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-6">Found items</h1>

      <form onSubmit={onFilterSubmit} className="card p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Search</label>
          <input className="input w-56" placeholder="Item name, found #, description" value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input w-44" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Category</label>
          <input className="input w-40" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} />
        </div>
        <button type="submit" className="btn-primary">Search</button>
      </form>

      {!result ? <Loading /> : result.items.length === 0 ? (
        <EmptyState title="No found items match your filters" />
      ) : (
        <>
          <div className="card divide-y divide-mist-200">
            {result.items.map((f) => (
              <div key={f.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{f.item_name}</p>
                  <p className="text-xs text-runway-700">{f.found_number} · {f.category} · Found {f.date_found} {f.terminal ? `· ${f.terminal}` : ''} · {f.storage_location || 'No storage location set'}</p>
                </div>
                <StatusBadge status={f.status} />
              </div>
            ))}
          </div>
          <Pagination page={result.page} total={result.total} pageSize={result.pageSize} onChange={setPage} />
        </>
      )}
    </div>
  );
}
