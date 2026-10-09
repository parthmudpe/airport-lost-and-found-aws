import { useEffect, useState } from 'react';
import { Api } from '../../api/client';
import Loading from '../../components/Loading.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import Modal from '../../components/Modal.jsx';
import { useToast } from '../../components/Toast.jsx';

const TABS = [
  { key: 'PENDING_REVIEW', label: 'Pending review' },
  { key: 'OWNERSHIP_PENDING', label: 'Ownership verification' },
  { key: 'COMPLETED', label: 'Returned' },
];

export default function MatchReview() {
  const [tab, setTab] = useState('PENDING_REVIEW');
  const [result, setResult] = useState(null);
  const toast = useToast();

  async function refresh() {
    setResult(await Api.listMatches({ status: tab, pageSize: 25 }));
  }
  useEffect(() => { refresh(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-6">Match review</h1>

      <div className="flex gap-2 mb-6">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`btn-secondary ${tab === t.key ? '!bg-runway-900 !text-white !border-runway-900' : ''}`}>
            {t.label}
          </button>
        ))}
      </div>

      {!result ? <Loading /> : result.items.length === 0 ? (
        <EmptyState title="Nothing here right now" hint="New possible matches will appear automatically when staff register found items or passengers report lost ones." />
      ) : (
        <div className="space-y-4">
          {result.items.map((m) => (
            <MatchCard key={m.id} match={m} tab={tab} onChanged={refresh} toast={toast} />
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
    setBusy(true);
    try {
      await Api.reviewMatch(match.id, action, notes);
      toast(action === 'CONFIRM' ? 'Match confirmed — ownership verification started.' : 'Match rejected.');
      setConfirmOpen(false);
      setRejectOpen(false);
      onChanged();
    } catch (err) {
      toast(err.response?.data?.error || 'Could not update the match.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="grid sm:grid-cols-2 gap-6 flex-1">
          <div>
            <p className="text-xs uppercase tracking-wide text-runway-700 mb-1">Lost report</p>
            <p className="font-medium text-sm">{match.lostItem?.item_name}</p>
            <p className="text-xs text-runway-700">{match.lostItem?.report_number} · Lost {match.lostItem?.date_lost}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-runway-700 mb-1">Found item</p>
            <p className="font-medium text-sm">{match.foundItem?.item_name}</p>
            <p className="text-xs text-runway-700">{match.foundItem?.found_number} · Found {match.foundItem?.date_found} · {match.foundItem?.storage_location}</p>
          </div>
        </div>
        <div className="text-right shrink-0 ml-4">
          <StatusBadge status={match.confidence} />
          <p className="text-xs text-runway-700 mt-1">{match.score}/100</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 text-xs mb-3">
        <div>
          <p className="font-semibold text-signal-600 mb-1">Similar</p>
          <ul className="list-disc list-inside text-runway-700 space-y-0.5">
            {(match.reasons || []).map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
        <div>
          <p className="font-semibold text-red-600 mb-1">Different</p>
          <ul className="list-disc list-inside text-runway-700 space-y-0.5">
            {(match.differences || []).length === 0 ? <li>None noted</li> : match.differences.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <StatusBadge status={match.status} />
        {tab === 'PENDING_REVIEW' && (
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setRejectOpen(true)}>Not a match</button>
            <button className="btn-primary" onClick={() => setConfirmOpen(true)}>Confirm match</button>
          </div>
        )}
        {tab === 'OWNERSHIP_PENDING' && <OwnershipReview matchId={match.id} onChanged={onChanged} toast={toast} />}
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm this match?"
        footer={<>
          <button className="btn-secondary" onClick={() => setConfirmOpen(false)}>Cancel</button>
          <button className="btn-primary" disabled={busy} onClick={() => act('CONFIRM')}>{busy ? 'Confirming…' : 'Confirm match'}</button>
        </>}>
        <p className="text-sm text-runway-700">
          This does not release the item. It starts ownership verification — the passenger will be asked to
          prove ownership before anything is handed over.
        </p>
      </Modal>

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Mark as not a match?"
        footer={<>
          <button className="btn-secondary" onClick={() => setRejectOpen(false)}>Cancel</button>
          <button className="btn-danger" disabled={busy} onClick={() => act('REJECT')}>{busy ? 'Rejecting…' : 'Not a match'}</button>
        </>}>
        <label className="label">Notes (optional)</label>
        <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Modal>
    </div>
  );
}

function OwnershipReview({ matchId, onChanged, toast }) {
  const [verification, setVerification] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => { Api.getMatchOwnershipVerification(matchId).then(setVerification); }, [matchId]);

  async function review(approved) {
    if (!verification) return;
    setBusy(true);
    try {
      await Api.reviewOwnership(verification.id, approved, notes);
      toast(approved ? 'Ownership verified.' : 'Ownership rejected.');
      onChanged();
    } catch (err) {
      toast(err.response?.data?.error || 'Could not review ownership.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function markReturned() {
    if (!verification) return;
    setBusy(true);
    try {
      await Api.markReturned(verification.id);
      toast('Item marked as returned.');
      onChanged();
    } catch (err) {
      toast(err.response?.data?.error || 'Could not mark returned.', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!verification) return <p className="text-xs text-runway-700">Loading verification…</p>;

  if (verification.status === 'REQUESTED') {
    return <p className="text-xs text-runway-700">Waiting on the passenger to submit ownership proof.</p>;
  }
  if (verification.status === 'SUBMITTED') {
    return (
      <div className="flex-1 ml-4">
        <p className="text-xs font-semibold mb-1">Passenger's proof</p>
        <p className="text-sm text-runway-800 mb-2">{verification.proof_text}</p>
        <textarea className="input mb-2" rows={2} placeholder="Review notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex gap-2">
          <button className="btn-danger" disabled={busy} onClick={() => review(false)}>Reject</button>
          <button className="btn-primary" disabled={busy} onClick={() => review(true)}>Approve ownership</button>
        </div>
      </div>
    );
  }
  if (verification.status === 'STAFF_APPROVED') {
    return <button className="btn-primary" disabled={busy} onClick={markReturned}>{busy ? 'Marking…' : 'Mark item returned'}</button>;
  }
  return <StatusBadge status={verification.status} />;
}
