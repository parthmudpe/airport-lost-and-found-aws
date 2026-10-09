const STYLES = {
  REPORTED: 'badge-info', SEARCHING: 'badge-info', POSSIBLE_MATCH: 'badge-warn',
  MATCH_CONFIRMED: 'badge-warn', OWNERSHIP_VERIFICATION: 'badge-warn', RETURNED: 'badge-success',
  CLOSED: 'badge-neutral', REJECTED: 'badge-danger',
  FOUND: 'badge-info', IN_STORAGE: 'badge-neutral', CLAIM_PENDING: 'badge-warn',
  UNCLAIMED: 'badge-danger',
  PENDING_REVIEW: 'badge-warn', STAFF_CONFIRMED: 'badge-info', STAFF_REJECTED: 'badge-danger',
  OWNERSHIP_PENDING: 'badge-warn', OWNERSHIP_VERIFIED: 'badge-success', OWNERSHIP_REJECTED: 'badge-danger',
  COMPLETED: 'badge-success',
  REQUESTED: 'badge-info', SUBMITTED: 'badge-warn', STAFF_APPROVED: 'badge-success',
  HIGH: 'badge-success', MEDIUM: 'badge-warn', LOW: 'badge-neutral',
};

export default function StatusBadge({ status }) {
  const cls = STYLES[status] || 'badge-neutral';
  return <span className={cls}>{status?.replaceAll('_', ' ')}</span>;
}
