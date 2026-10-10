import { useCallback, useEffect, useState } from 'react';
import { Api } from '../../api/client';
import Loading from '../../components/Loading.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { useToast } from '../../components/Toast.jsx';

function getErrorMessage(err, fallback) {
  return (
    err?.response?.data?.error ||
    err?.message ||
    fallback
  );
}

export default function MyReports() {
  const [reports, setReports] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const items = await Api.myLostItems();
      setReports(items);
    } catch (err) {
      setError(
        getErrorMessage(err, 'Unable to load your reports. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading && reports === null) {
    return <Loading />;
  }

  if (reports === null) {
    return (
      <div className="card p-6">
        <h1 className="font-display text-xl font-bold mb-2">
          Unable to load reports
        </h1>

        <p role="alert" className="text-sm text-red-600 mb-4">
          {error || 'Something went wrong while loading your reports.'}
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
          My reports
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
            className="btn-primary"
            onClick={refresh}
            disabled={loading}
          >
            {loading ? 'Retrying...' : 'Try again'}
          </button>
        </div>
      )}

      {reports.length === 0 ? (
        <EmptyState
          title="No reports yet"
          hint="Once you report a lost item, it will show up here with live status updates."
        />
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <ReportRow
              key={report.id}
              report={report}
              expanded={expandedId === report.id}
              onToggle={() =>
                setExpandedId(
                  expandedId === report.id ? null : report.id
                )
              }
              onChanged={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportRow({ report, expanded, onToggle, onChanged }) {
  return (
    <div className="card">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left focus-ring rounded-lg"
        aria-expanded={expanded}
      >
        <div>
          <p className="font-medium">{report.item_name}</p>

          <p className="text-xs text-runway-700">
            {report.report_number} · Lost {report.date_lost}
            {report.terminal ? ` · ${report.terminal}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge status={report.status} />
          <span className="text-runway-700">
            {expanded ? '−' : '+'}
          </span>
        </div>
      </button>

      {expanded && (
        <ReportDetail
          report={report}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}

function ReportDetail({ report, onChanged }) {
  const [matches, setMatches] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMatches = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await Api.getLostItemMatches(report.id);
      setMatches(result);
    } catch (err) {
      setError(
        getErrorMessage(err, 'Unable to load possible matches.')
      );
    } finally {
      setLoading(false);
    }
  }, [report.id]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  return (
    <div className="border-t border-mist-200 px-4 py-4 space-y-4">
      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <Field label="Category" value={report.category} />

        <Field
          label="Brand / model"
          value={
            [report.brand, report.model].filter(Boolean).join(' / ') || '—'
          }
        />

        <Field label="Color" value={report.color || '—'} />

        <Field
          label="Location"
          value={
            [report.terminal, report.location_area]
              .filter(Boolean)
              .join(', ') || '—'
          }
        />

        <Field
          label="Description"
          value={report.description || '—'}
          full
        />
      </dl>

      <div>
        <p className="text-sm font-semibold mb-2">
          Possible matches
        </p>

        {loading && <Loading />}

        {!loading && error && (
          <div>
            <p role="alert" className="text-sm text-red-600 mb-3">
              {error}
            </p>

            <button
              type="button"
              className="btn-secondary"
              onClick={loadMatches}
              disabled={loading}
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && matches?.length === 0 && (
          <p className="text-sm text-runway-700">
            No possible matches yet. We'll notify you as soon as staff
            log a found item that could be yours.
          </p>
        )}

        {!loading && !error && matches?.length > 0 && (
          <div className="space-y-2">
            {matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                onChanged={onChanged}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, full }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <dt className="text-runway-700">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function MatchCard({ match, onChanged }) {
  const [verification, setVerification] = useState(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [proofText, setProofText] = useState('');
  const [busy, setBusy] = useState(false);

  const toast = useToast();
  const needsProof = match.status === 'OWNERSHIP_PENDING';

  const loadVerification = useCallback(async () => {
    setVerificationLoading(true);
    setVerificationError('');

    try {
      const result = await Api.getMatchOwnershipVerification(match.id);
      setVerification(result);
    } catch (err) {
      setVerificationError(
        getErrorMessage(err, 'Unable to load ownership verification.')
      );
    } finally {
      setVerificationLoading(false);
    }
  }, [match.id]);

  useEffect(() => {
    if (needsProof) {
      loadVerification();
    }
  }, [needsProof, loadVerification]);

  async function submitProof() {
    if (!verification || !proofText.trim() || busy) {
      return;
    }

    setBusy(true);

    try {
      const formData = new FormData();
      formData.append('proofText', proofText.trim());

      await Api.submitOwnershipProof(verification.id, formData);

      toast('Ownership proof submitted. Staff will review it shortly.');
      setProofText('');
      await loadVerification();
      await onChanged();
    } catch (err) {
      toast(
        getErrorMessage(err, 'Could not submit proof.'),
        'error'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-mist-200 p-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="font-medium text-sm">
          {match.foundItem?.item_name}
        </p>

        <div className="flex items-center gap-2">
          <StatusBadge status={match.confidence} />
          <span className="text-xs text-runway-700">
            {match.score}/100
          </span>
        </div>
      </div>

      <p className="text-xs text-runway-700 mb-2">
        Found at {match.foundItem?.airport_id
          ? 'the reported airport'
          : ''}
        {' '}on {match.foundItem?.date_found}
      </p>

      {match.reasons?.length > 0 && (
        <ul className="text-xs text-signal-600 list-disc list-inside mb-2">
          {match.reasons.slice(0, 4).map((reason, index) => (
            <li key={index}>{reason}</li>
          ))}
        </ul>
      )}

      <StatusBadge status={match.status} />

      {needsProof && verificationLoading && !verification && (
        <p className="mt-3 text-sm text-runway-700">
          Loading ownership verification...
        </p>
      )}

      {needsProof && verificationError && (
        <div className="mt-3 border-t border-mist-200 pt-3">
          <p role="alert" className="text-sm text-red-600 mb-3">
            {verificationError}
          </p>

          <button
            type="button"
            className="btn-secondary"
            onClick={loadVerification}
            disabled={verificationLoading}
          >
            {verificationLoading ? 'Retrying...' : 'Try again'}
          </button>
        </div>
      )}

      {needsProof &&
        verification?.status === 'REQUESTED' &&
        !verificationLoading && (
          <div className="mt-3 border-t border-mist-200 pt-3">
            <p className="text-sm font-medium mb-1">
              Prove this is yours
            </p>

            <p className="text-xs text-runway-700 mb-2">
              Describe something only the owner would know — a serial
              number, purchase details, or a unique mark.
            </p>

            <textarea
              className="input mb-2"
              rows={2}
              value={proofText}
              onChange={(event) => setProofText(event.target.value)}
              placeholder="e.g. Serial number ends in 2345, purchased at..."
            />

            <button
              type="button"
              className="btn-primary"
              disabled={busy || !proofText.trim()}
              onClick={submitProof}
            >
              {busy ? 'Submitting…' : 'Submit proof'}
            </button>
          </div>
        )}

      {needsProof && verification?.status === 'SUBMITTED' && (
        <p className="mt-3 text-xs text-runway-700 border-t border-mist-200 pt-3">
          Your proof was submitted and is awaiting staff review.
        </p>
      )}
    </div>
  );
}