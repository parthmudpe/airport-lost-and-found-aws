const express = require('express');
const { z } = require('zod');
const {
  Matches,
  LostItems,
  FoundItems,
  OwnershipVerifications,
} = require('../db/repository');

const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const validate = require('../middleware/validate');
const { notify } = require('../services/notificationService');
const { audit } = require('../services/auditService');

const router = express.Router();

// GET /matches - staff/admin queue of matches
router.get(
  '/',
  requireAuth,
  requireRole('STAFF', 'ADMIN'),
  (req, res, next) => {
    try {
      const { status, page, pageSize } = req.query;

      const result = Matches.list({
        status,
        page: page ? +page : 1,
        pageSize: pageSize ? +pageSize : 20,
      });

      const enriched = result.items.map((m) => ({
        ...m,
        lostItem: LostItems.getById(m.lost_item_id),
        foundItem: FoundItems.getById(m.found_item_id),
      }));

      res.json({ ...result, items: enriched });
    } catch (e) {
      next(e);
    }
  }
);

// GET /matches/:id
router.get('/:id', requireAuth, (req, res, next) => {
  try {
    const match = Matches.getById(req.params.id);

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const lostItem = LostItems.getById(match.lost_item_id);

    if (!lostItem) {
      return res.status(404).json({ error: 'Lost report not found' });
    }

    if (
      req.user.role === 'PASSENGER' &&
      lostItem.user_id !== req.user.sub
    ) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const foundItem = FoundItems.getById(match.found_item_id);

    // Do not expose private found-item details to passengers.
    const safeFoundItem =
      req.user.role === 'PASSENGER' && foundItem
        ? {
            ...foundItem,
            serial_number: foundItem.serial_number
              ? maskSerial(foundItem.serial_number)
              : null,
            storage_location: undefined,
          }
        : foundItem;

    res.json({
      match: {
        ...match,
        lostItem,
        foundItem: safeFoundItem,
      },
    });
  } catch (e) {
    next(e);
  }
});

// GET /matches/:id/ownership-verification
router.get(
  '/:id/ownership-verification',
  requireAuth,
  (req, res, next) => {
    try {
      const match = Matches.getById(req.params.id);

      if (!match) {
        return res.status(404).json({ error: 'Match not found' });
      }

      const lostItem = LostItems.getById(match.lost_item_id);

      if (!lostItem) {
        return res.status(404).json({ error: 'Lost report not found' });
      }

      if (
        req.user.role === 'PASSENGER' &&
        lostItem.user_id !== req.user.sub
      ) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const records = OwnershipVerifications.listForMatch(match.id);

      res.json({
        ownershipVerification: records[0] || null,
      });
    } catch (e) {
      next(e);
    }
  }
);

// Staff can confirm or reject a possible match.
const reviewSchema = z.object({
  action: z.enum(['CONFIRM', 'REJECT']),
  notes: z.string().optional(),
});

router.put(
  '/:id',
  requireAuth,
  requireRole('STAFF', 'ADMIN'),
  validate(reviewSchema),
  async (req, res, next) => {
    try {
      const match = Matches.getById(req.params.id);

      if (!match) {
        return res.status(404).json({ error: 'Match not found' });
      }

      // Prevent re-reviewing a match that has already been processed.
      if (match.status !== 'PENDING_REVIEW') {
        return res.status(409).json({
          error:
            'This match has already been reviewed. Refresh the page and try again.',
        });
      }

      const lostItem = LostItems.getById(match.lost_item_id);
      const foundItem = FoundItems.getById(match.found_item_id);

      if (!lostItem || !foundItem) {
        return res.status(409).json({
          error:
            'The associated lost report or found item no longer exists.',
        });
      }

      // REJECT a candidate match.
      if (req.body.action === 'REJECT') {
        Matches.updateStatus(
          match.id,
          'STAFF_REJECTED',
          req.user.sub
        );

        LostItems.setStatus(lostItem.id, 'SEARCHING');

        await notify(lostItem.user_id, 'MATCH_REJECTED', {
          reportNumber: lostItem.report_number,
          relatedEntityType: 'MATCH',
          relatedEntityId: match.id,
        });

        audit(req, {
          action: 'MATCH_REJECTED',
          entityType: 'MATCH',
          entityId: match.id,
        });

        return res.json({
          match: Matches.getById(match.id),
        });
      }

      // CONFIRM: prevent conflicting active claims.
      const blockingStatuses = new Set([
        'OWNERSHIP_PENDING',
        'OWNERSHIP_VERIFIED',
        'COMPLETED',
      ]);

      const relatedMatches = [
        ...Matches.listForLostItem(lostItem.id),
        ...Matches.listForFoundItem(foundItem.id),
      ];

      const conflictingMatch = relatedMatches.find(
        (candidate) =>
          candidate.id !== match.id &&
          blockingStatuses.has(candidate.status)
      );

      if (conflictingMatch) {
        return res.status(409).json({
          error:
            'This lost report or found item already has a confirmed claim. Refresh the page and review its status.',
        });
      }

      // Start ownership verification only when no conflict exists.
      Matches.updateStatus(
        match.id,
        'OWNERSHIP_PENDING',
        req.user.sub
      );

      LostItems.setStatus(
        lostItem.id,
        'OWNERSHIP_VERIFICATION'
      );

      FoundItems.setStatus(
        foundItem.id,
        'OWNERSHIP_VERIFICATION'
      );

      const verification = OwnershipVerifications.create({
        matchId: match.id,
        lostItemId: lostItem.id,
        passengerId: lostItem.user_id,
      });

      await notify(
        lostItem.user_id,
        'OWNERSHIP_VERIFICATION_REQUESTED',
        {
          reportNumber: lostItem.report_number,
          relatedEntityType: 'OWNERSHIP_VERIFICATION',
          relatedEntityId: verification.id,
        }
      );

      audit(req, {
        action: 'MATCH_CONFIRMED',
        entityType: 'MATCH',
        entityId: match.id,
      });

      return res.json({
        match: Matches.getById(match.id),
        ownershipVerification: verification,
      });
    } catch (e) {
      next(e);
    }
  }
);

function maskSerial(serial) {
  if (serial.length <= 4) {
    return '*'.repeat(serial.length);
  }

  return `${'*'.repeat(serial.length - 4)}${serial.slice(-4)}`;
}

module.exports = router;