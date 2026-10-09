import { useEffect, useState } from 'react';
import { Api } from '../../api/client';
import Loading from '../../components/Loading.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { useToast } from '../../components/Toast.jsx';

export default function MyReports() {
  const [reports, setReports] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  async function refresh() {
    const items = await Api.myLostItems();
    setReports(items);
  }
  useEffect(() => { refresh(); }, []);

  if (!reports) return <Loading />;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-6">My reports</h1>
      {reports.length === 0 ? (
        <EmptyState title="No reports yet" hint="Once you report a lost item, it will show up here with live status updates." />
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <ReportRow key={r.id} report={r} expanded={expandedId === r.id}
              onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
              onChanged={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportRow({ report, expanded, onToggle, onChanged }) {
  return (
    <div className="card">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 text-left focus-ring rounded-lg">
        <div>
          <p className="font-medium">{report.item_name}</p>
          <p className="text-xs text-runway-700">{report.report_number} · Lost {report.date_lost}{report.terminal ? ` · ${report.terminal}` : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={report.status} />
          <span className="text-runway-700">{expanded ? '−' : '+'}</span>
        </div>
      </button>
      {expanded && <ReportDetail report={report} onChanged={onChanged} />}
    </div>
  );
}

function ReportDetail({ report, onChanged }) {
  const [matches, setMatches] = useState(null);
  useEffect(() => { Api.getLostItemMatches(report.id).then(setMatches); }, [report.id]);

  return (
    <div className="border-t border-mist-200 px-4 py-4 space-y-4">
      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <Field label="Category" value={report.category} />
        <Field label="Brand / model" value={[report.brand, report.model].filter(Boolean).join(' / ') || '—'} />
        <Field label="Color" value={report.color || '—'} />
        <Field label="Location" value={[report.terminal, report.location_area].filter(Boolean).join(', ') || '—'} />
        <Field label="Description" value={report.description || '—'} full />
      </dl>

      <div>
        <p className="text-sm font-semibold mb-2">Possible matches</p>
        {!matches ? <Loading /> : matches.length === 0 ? (
          <p className="text-sm text-runway-700">No possible matches yet. We'll notify you as soon as staff log a found item that could be yours.</p>
        ) : (
          <div className="space-y-2">
            {matches.map((m) => <MatchCard key={m.id} match={m} report={report} onChanged={onChanged} />)}
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
  const [proofText, setProofText] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const needsProof = match.status === 'OWNERSHIP_PENDING';

  useEffect(() => {
    if (needsProof) {
      Api.getMatchOwnershipVerification(match.id).then(setVerification);
    }
  }, [needsProof, match.id]);

  async function submitProof() {
    if (!verification) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('proofText', proofText);
      await Api.submitOwnershipProof(verification.id, fd);
      toast('Ownership proof submitted. Staff will review it shortly.');
      onChanged();
    } catch (err) {
      toast(err.response?.data?.error || 'Could not submit proof.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-mist-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="font-medium text-sm">{match.foundItem?.item_name}</p>
        <div className="flex items-center gap-2">
          <StatusBadge status={match.confidence} />
          <span className="text-xs text-runway-700">{match.score}/100</span>
        </div>
      </div>
      <p className="text-xs text-runway-700 mb-2">Found at {match.foundItem?.airport_id ? 'the reported airport' : ''} on {match.foundItem?.date_found}</p>
      {match.reasons?.length > 0 && (
        <ul className="text-xs text-signal-600 list-disc list-inside mb-2">
          {match.reasons.slice(0, 4).map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}
      <StatusBadge status={match.status} />

      {needsProof && verification?.status === 'REQUESTED' && (
        <div className="mt-3 border-t border-mist-200 pt-3">
          <p className="text-sm font-medium mb-1">Prove this is yours</p>
          <p className="text-xs text-runway-700 mb-2">
            Describe something only the owner would know — a serial number, purchase details, or a unique mark.
          </p>
          <textarea className="input mb-2" rows={2} value={proofText} onChange={(e) => setProofText(e.target.value)}
            placeholder="e.g. Serial number ends in 2345, purchased at..." />
          <button className="btn-primary" disabled={busy || !proofText} onClick={submitProof}>
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
