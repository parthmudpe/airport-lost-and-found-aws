const express = require('express');
const {
  LostItems,
  FoundItems,
  Matches,
  Notifications,
  Users,
  AuditLogs,
} = require('../db/repository');

const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

function toMap(rows) {
  return rows.reduce((acc, r) => {
    acc[r.status] = r.c;
    return acc;
  }, {});
}

// PASSENGER DASHBOARD
router.get(
  '/passenger',
  requireAuth,
  requireRole('PASSENGER'),
  (req, res, next) => {
    try {
      const reports = LostItems.listByUser(req.user.sub);

      const active = reports.filter(
        (r) => !['RETURNED', 'CLOSED', 'REJECTED'].includes(r.status)
      );

      const possibleMatches = reports.filter(
        (r) => r.status === 'POSSIBLE_MATCH'
      );

      const underVerification = reports.filter(
        (r) => r.status === 'OWNERSHIP_VERIFICATION'
      );

      const readyOrReturned = reports.filter(
        (r) => ['MATCH_CONFIRMED', 'RETURNED'].includes(r.status)
      );

      const returned = reports.filter(
        (r) => r.status === 'RETURNED'
      );

      const notifications = Notifications
        .listForUser(req.user.sub)
        .slice(0, 10);

      res.json({
        activeReports: active.length,
        possibleMatches: possibleMatches.length,
        underVerification: underVerification.length,
        readyForCollection: readyOrReturned.length,
        returnedItems: returned.length,
        reports,
        notifications,
      });
    } catch (e) {
      next(e);
    }
  }
);

// STAFF DASHBOARD
router.get(
  '/staff',
  requireAuth,
  requireRole('STAFF', 'ADMIN'),
  (req, res, next) => {
    try {
      const lostByStatus = toMap(LostItems.countByStatus());
      const foundByStatus = toMap(FoundItems.countByStatus());
      const matchByStatus = toMap(Matches.countByStatus());

      res.json({
        totalLostReports: LostItems.count(),
        totalFoundItems: FoundItems.count(),
        possibleMatches: matchByStatus.PENDING_REVIEW || 0,
        pendingOwnershipVerification:
          matchByStatus.OWNERSHIP_PENDING || 0,
        itemsReturned: foundByStatus.RETURNED || 0,
        unclaimedItems: foundByStatus.UNCLAIMED || 0,
        lostByStatus,
        foundByStatus,
        matchByStatus,
      });
    } catch (e) {
      next(e);
    }
  }
);

// ADMIN DASHBOARD
router.get(
  '/admin',
  requireAuth,
  requireRole('ADMIN'),
  (req, res, next) => {
    try {
      const totalLost = LostItems.count();
      const totalFound = FoundItems.count();

      const lostByStatus = toMap(LostItems.countByStatus());
      const matchByStatus = toMap(Matches.countByStatus());

      const completed = matchByStatus.COMPLETED || 0;

      // Count distinct lost reports with a possible or confirmed match.
      // Multiple match records for one lost report count only once.
      const matchedStatuses = new Set([
        'POSSIBLE_MATCH',
        'OWNERSHIP_VERIFICATION',
        'MATCH_CONFIRMED',
        'RETURNED',
      ]);

      const lostReports = LostItems.search({
        page: 1,
        pageSize: Math.max(totalLost, 1),
      }).items;

      const matchedLostReports = lostReports.filter(
        (item) => matchedStatuses.has(item.status)
      ).length;

      const matchRate = totalLost > 0
        ? Math.round((matchedLostReports / totalLost) * 100)
        : 0;

      // Count unresolved lost reports, including those without matches.
      const resolvedStatuses = new Set([
        'RETURNED',
        'CLOSED',
        'REJECTED',
      ]);

      const pendingCases = Object.entries(lostByStatus)
        .filter(([status]) => !resolvedStatuses.has(status))
        .reduce((sum, [, count]) => sum + count, 0);

      const recentActivity = AuditLogs
        .list({ page: 1, pageSize: 15 })
        .items;

      res.json({
        totalUsers: Users.count(),
        totalLostItems: totalLost,
        totalFoundItems: totalFound,
        matchRate,
        successfulReturns: completed,
        pendingCases,
        recentActivity,
      });
    } catch (e) {
      next(e);
    }
  }
);

module.exports = router;