import PhotoGallery from '../../components/PhotoGallery.jsx';
import { useCallback, useEffect, useState } from 'react';
import { Api } from '../../api/client';
import Loading from '../../components/Loading.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';

const STATUSES = [
  'REPORTED',
  'SEARCHING',
  'POSSIBLE_MATCH',
  'MATCH_CONFIRMED',
  'OWNERSHIP_VERIFICATION',
  'RETURNED',
  'CLOSED',
  'REJECTED',
];

const INITIAL_FILTERS = {
  category: '',
  status: '',
  q: '',
};

function getErrorMessage(err) {
  return (
    err?.response?.data?.error ||
    err?.message ||
    'Unable to load lost reports. Please try again.'
  );
}

export default function LostItems() {
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(INITIAL_FILTERS);
  const [result, setResult] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  const loadResults = useCallback(async (searchFilters, searchPage) => {
    setLoading(true);
    setError('');

    try {
      const data = await Api.searchLostItems({
        ...searchFilters,
        page: searchPage,
        pageSize: 15,
      });

      setResult(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResults(appliedFilters, page);
  }, [loadResults, appliedFilters, page, retryKey]);

  function onFilterSubmit(event) {
    event.preventDefault();
    setPage(1);
    setAppliedFilters({ ...filters });
    setRetryKey((key) => key + 1);
  }

  function retrySearch() {
    setRetryKey((key) => key + 1);
  }

  if (result === null && loading) {
    return <Loading />;
  }

  if (result === null) {
    return (
      <div className="card p-6">
        <h1 className="font-display text-xl font-bold mb-2">
          Unable to load lost reports
        </h1>

        <p role="alert" className="text-sm text-red-600 mb-4">
          {error || 'Something went wrong while loading reports.'}
        </p>

        <button
          type="button"
          className="btn-primary"
          onClick={retrySearch}
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
          Lost item reports
        </h1>

        <button
          type="button"
          className="btn-secondary"
          onClick={retrySearch}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <form
        onSubmit={onFilterSubmit}
        className="card p-4 mb-6 flex flex-wrap gap-3 items-end"
      >
        <div>
          <label className="label" htmlFor="lost-search">
            Search
          </label>

          <input
            id="lost-search"
            className="input w-56"
            placeholder="Item name, report #, description"
            value={filters.q}
            onChange={(event) =>
              setFilters({ ...filters, q: event.target.value })
            }
          />
        </div>

        <div>
          <label className="label" htmlFor="lost-status">
            Status
          </label>

          <select
            id="lost-status"
            className="input w-44"
            value={filters.status}
            onChange={(event) =>
              setFilters({ ...filters, status: event.target.value })
            }
          >
            <option value="">All statuses</option>

            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="lost-category">
            Category
          </label>

          <input
            id="lost-category"
            className="input w-40"
            value={filters.category}
            onChange={(event) =>
              setFilters({ ...filters, category: event.target.value })
            }
          />
        </div>

        <button
          type="submit"
          className="btn-primary"
          disabled={loading}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="card p-4 mb-4">
          <p role="alert" className="text-sm text-red-600 mb-3">
            {error}
          </p>

          <button
            type="button"
            className="btn-secondary"
            onClick={retrySearch}
            disabled={loading}
          >
            Try again
          </button>
        </div>
      )}

      {loading && (
        <p className="text-sm text-runway-700 mb-3">
          Loading reports...
        </p>
      )}

      {result.items.length === 0 ? (
        <EmptyState title="No lost reports match your filters" />
      ) : (
        <>
          <div className="card divide-y divide-mist-200">
            {result.items.map((report) => (
              <div
                key={report.id}
                className="px-4 py-3 flex flex-wrap items-center justify-between gap-3"
              >
                                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">
                    {report.item_name}
                  </p>

                  <p className="text-xs text-runway-700">
                    {report.report_number} · {report.category} · Lost{' '}
                    {report.date_lost}
                    {report.terminal ? ` · ${report.terminal}` : ''}
                  </p>

                  <PhotoGallery
                    images={report.images}
                    label="Lost item photos"
                  />
                </div>

                <StatusBadge status={report.status} />
              </div>
            ))}
          </div>

          <Pagination
            page={result.page}
            total={result.total}
            pageSize={result.pageSize}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}

export function Pagination({ page, total, pageSize, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));

  if (pages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-3 mt-4 text-sm">
      <button
        type="button"
        className="btn-secondary"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </button>

      <span className="text-runway-700">
        Page {page} of {pages}
      </span>

      <button
        type="button"
        className="btn-secondary"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
}