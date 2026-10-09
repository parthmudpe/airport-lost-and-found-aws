import { useEffect, useState } from 'react';
import { Api } from '../../api/client';
import Loading from '../../components/Loading.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';

const STATUSES = ['REPORTED', 'SEARCHING', 'POSSIBLE_MATCH', 'MATCH_CONFIRMED', 'OWNERSHIP_VERIFICATION', 'RETURNED', 'CLOSED', 'REJECTED'];

export default function LostItems() {
  const [filters, setFilters] = useState({ category: '', status: '', q: '' });
  const [result, setResult] = useState(null);
  const [page, setPage] = useState(1);

  async function search() {
    setResult(await Api.searchLostItems({ ...filters, page, pageSize: 15 }));
  }
  useEffect(() => { search(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  function onFilterSubmit(e) {
    e.preventDefault();
    setPage(1);
    search();
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-6">Lost item reports</h1>

      <form onSubmit={onFilterSubmit} className="card p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Search</label>
          <input className="input w-56" placeholder="Item name, report #, description" value={filters.q}
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
        <EmptyState title="No lost reports match your filters" />
      ) : (
        <>
          <div className="card divide-y divide-mist-200">
            {result.items.map((r) => (
              <div key={r.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{r.item_name}</p>
                  <p className="text-xs text-runway-700">{r.report_number} · {r.category} · Lost {r.date_lost} {r.terminal ? `· ${r.terminal}` : ''}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
          <Pagination page={result.page} total={result.total} pageSize={result.pageSize} onChange={setPage} />
        </>
      )}
    </div>
  );
}

export function Pagination({ page, total, pageSize, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 mt-4 text-sm">
      <button className="btn-secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
      <span className="text-runway-700">Page {page} of {pages}</span>
      <button className="btn-secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button>
    </div>
  );
}
