import PhotoGallery from '../../components/PhotoGallery.jsx';
import { useCallback, useEffect, useState } from 'react';
import { Api } from '../../api/client';
import Loading from '../../components/Loading.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import Modal from '../../components/Modal.jsx';
import { useToast } from '../../components/Toast.jsx';

const TABS = [
  { key: 'PENDING_REVIEW', label: 'Pending review' },
  { key: 'OWNERSHIP_PENDING', label: 'Ownership verification' },
  { key: 'OWNERSHIP_VERIFIED', label: 'Ready to return' },
  { key: 'COMPLETED', label: 'Returned' },
];

function getErrorMessage(err, fallback) {
  return (
    err?.response?.data?.error ||
    err?.message ||
    fallback
  );
}

export default function MatchReview() {
  const [tab, setTab] = useState('PENDING_REVIEW');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  const toast = useToast();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const data = await Api.listMatches({
        status: tab,
        pageSize: 25,
      });

      setResult(data);
    } catch (err) {
      setError(
        getErrorMessage(err, 'Unable to load matches. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    refresh();
  }, [refresh, retryKey]);

  function retry() {
    setRetryKey((key) => key + 1);
  }

  if (loading && !result) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold mb-6">
          Match review
        </h1>
        <Loading />
      </div>
    );
  }

  if (!result) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold mb-6">
          Match review
        </h1>

        <div className="card p-6">
          <p className="font-display text-xl font-bold mb-2">
            Unable to load matches
          </p>

          <p role="alert" className="text-sm text-red-600 mb-4">
            {error || 'Something went wrong while loading matches.'}
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
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="font-display text-2xl font-bold">
          Match review
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

      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((item) => (
          <button
            type="button"
            key={item.key}
            onClick={() => setTab(item.key)}
            disabled={loading}
            className={`btn-secondary ${
              tab === item.key
                ? '!bg-runway-900 !text-white !border-runway-900'
                : ''
            }`}
          >
            {item.label}
          </button>
        ))}
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
          Loading matches...
        </p>
      )}

      {result.items.length === 0 ? (
        <EmptyState
          title="Nothing here right now"
          hint="New possible matches will appear automatically when staff register found items or passengers report lost ones."
        />
      ) : (
        <div className="space-y-4">
          {result.items.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              tab={tab}
              onChanged={refresh}
              toast={toast}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MatchCard({ match, tab, onChanged, toast }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  async function act(action) {
    if (busy) return;

    setBusy(true);

    try {
      await Api.reviewMatch(match.id, action, notes);

      toast(
        action === 'CONFIRM'
          ? 'Match confirmed — ownership verification started.'
          : 'Match rejected.'
      );

      setConfirmOpen(false);
      setRejectOpen(false);

      await onChanged();
    } catch (err) {
      toast(
        getErrorMessage(err, 'Could not update the match.'),
        'error'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="grid sm:grid-cols-2 gap-6 flex-1 min-w-0">
          <div>
            <p className="text-xs uppercase tracking-wide text-runway-700 mb-1">
              Lost report
            </p>
            <p className="font-medium text-sm">
              {match.lostItem?.item_name || 'Unknown item'}
            </p>
            <p className="text-xs text-runway-700">
              {match.lostItem?.report_number} · Lost{' '}
              {match.lostItem?.date_lost}
            </p>
            <PhotoGallery
              images={match.lostItem?.images}
              label="Lost item photos"
            />
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-runway-700 mb-1">
              Found item
            </p>
            <p className="font-medium text-sm">
              {match.foundItem?.item_name || 'Unknown item'}
            </p>
            <p className="text-xs text-runway-700">
              {match.foundItem?.found_number} · Found{' '}
              {match.foundItem?.date_found}
              {match.foundItem?.storage_location
                ? ` · ${match.foundItem.storage_location}`
                : ''}
            </p>
            <PhotoGallery
              images={match.foundItem?.images}
              label="Found item photos"
            />
          </div>
        </div>

        <div className="text-right shrink-0">
          <StatusBadge status={match.confidence} />
          <p className="text-xs text-runway-700 mt-1">
            {match.score}/100
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 text-xs mb-3">
        <div>
          <p className="font-semibold text-signal-600 mb-1">
            Similar
          </p>
          <ul className="list-disc list-inside text-runway-700 space-y-0.5">
            {(match.reasons || []).length === 0 ? (
              <li>No matching details recorded</li>
            ) : (
              match.reasons.map((reason, index) => (
                <li key={index}>{reason}</li>
              ))
            )}
          </ul>
        </div>

        <div>
          <p className="font-semibold text-red-600 mb-1">
            Different
          </p>
          <ul className="list-disc list-inside text-runway-700 space-y-0.5">
            {(match.differences || []).length === 0 ? (
              <li>None noted</li>
            ) : (
              match.differences.map((difference, index) => (
                <li key={index}>{difference}</li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusBadge status={match.status} />

        {tab === 'PENDING_REVIEW' && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setRejectOpen(true)}
              disabled={busy}
            >
              Not a match
            </button>

            <button
              type="button"
              className="btn-primary"
              onClick={() => setConfirmOpen(true)}
              disabled={busy}
            >
              Confirm match
            </button>
          </div>
        )}

        {['OWNERSHIP_PENDING', 'OWNERSHIP_VERIFIED'].includes(tab) && (
          <OwnershipReview
            matchId={match.id}
            onChanged={onChanged}
            toast={toast}
          />
        )}
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => !busy && setConfirmOpen(false)}
        title="Confirm this match?"
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setConfirmOpen(false)}
              disabled={busy}
            >
              Cancel
            </button>

            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => act('CONFIRM')}
            >
              {busy ? 'Confirming…' : 'Confirm match'}
            </button>
          </>
        }
      >
        <p className="text-sm text-runway-700">
          This does not release the item. It starts ownership verification.
          The passenger must prove ownership before the item is handed over.
        </p>
      </Modal>

      <Modal
        open={rejectOpen}
        onClose={() => !busy && setRejectOpen(false)}
        title="Mark as not a match?"
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setRejectOpen(false)}
              disabled={busy}
            >
              Cancel
            </button>

            <button
              type="button"
              className="btn-danger"
              disabled={busy}
              onClick={() => act('REJECT')}
            >
              {busy ? 'Rejecting…' : 'Not a match'}
            </button>
          </>
        }
      >
        <label className="label" htmlFor={`match-notes-${match.id}`}>
          Notes (optional)
        </label>

        <textarea
          id={`match-notes-${match.id}`}
          className="input"
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </Modal>
    </div>
  );
}

function OwnershipReview({ matchId, onChanged, toast }) {
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState('');

  const loadVerification = useCallback(async () => {
    setLoading(true);
    setError('');
    setVerification(null);

    try {
      const data = await Api.getMatchOwnershipVerification(matchId);
      setVerification(data);
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'Unable to load the ownership verification record.'
        )
      );
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    loadVerification();
  }, [loadVerification, retryKey]);

  async function review(approved) {
    if (!verification || busy) return;

    setBusy(true);

    try {
      await Api.reviewOwnership(verification.id, approved, notes);

      toast(
        approved ? 'Ownership verified.' : 'Ownership rejected.'
      );

      await onChanged();
    } catch (err) {
      toast(
        getErrorMessage(err, 'Could not review ownership.'),
        'error'
      );
    } finally {
      setBusy(false);
    }
  }

  async function markReturned() {
    if (!verification || busy) return;

    setBusy(true);

    try {
      await Api.markReturned(verification.id);

      toast('Item marked as returned.');

      await onChanged();
    } catch (err) {
      toast(
        getErrorMessage(err, 'Could not mark item as returned.'),
        'error'
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <p className="text-xs text-runway-700">
        Loading verification...
      </p>
    );
  }

  if (error) {
    return (
      <div className="max-w-sm">
        <p role="alert" className="text-xs text-red-600 mb-2">
          {error}
        </p>

        <button
          type="button"
          className="btn-secondary"
          onClick={() => setRetryKey((key) => key + 1)}
          disabled={loading}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!verification) {
    return (
      <p className="text-xs text-runway-700">
        No ownership verification record was found for this match.
      </p>
    );
  }

  if (verification.status === 'REQUESTED') {
    return (
      <p className="text-xs text-runway-700">
        Waiting for the passenger to submit ownership proof.
      </p>
    );
  }

  if (verification.status === 'SUBMITTED') {
    return (
      <div className="flex-1 min-w-0 sm:ml-4">
        <p className="text-xs font-semibold mb-1">
          Passenger's proof
        </p>

        <p className="text-sm text-runway-800 mb-2 whitespace-pre-wrap">
          {verification.proof_text || 'No written proof was provided.'}
        </p>

        <label
          className="label"
          htmlFor={`verification-notes-${matchId}`}
        >
          Review notes (optional)
        </label>

        <textarea
          id={`verification-notes-${matchId}`}
          className="input mb-2"
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          disabled={busy}
        />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-danger"
            disabled={busy}
            onClick={() => review(false)}
          >
            {busy ? 'Processing…' : 'Reject'}
          </button>

          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => review(true)}
          >
            {busy ? 'Processing…' : 'Approve ownership'}
          </button>
        </div>
      </div>
    );
  }

  if (verification.status === 'STAFF_APPROVED') {
    return (
      <button
        type="button"
        className="btn-primary"
        disabled={busy}
        onClick={markReturned}
      >
        {busy ? 'Marking…' : 'Mark item returned'}
      </button>
    );
  }

  return <StatusBadge status={verification.status} />;
}