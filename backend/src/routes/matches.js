const express = require('express');
const { z } = require('zod');
const { Matches, LostItems, FoundItems, OwnershipVerifications } = require('../db/repository');

const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const validate = require('../middleware/validate');
const { notify } = require('../services/notificationService');
const { audit } = require('../services/auditService');

const router = express.Router();

// GET /matches - staff/admin queue of matches pending review
router.get('/', requireAuth, requireRole('STAFF', 'ADMIN'), (req, res, next) => {
  try {
    const { status, page, pageSize } = req.query;
    const result = Matches.list({ status, page: page ? +page : 1, pageSize: pageSize ? +pageSize : 20 });
    const enriched = result.items.map((m) => ({
      ...m,
      lostItem: LostItems.getById(m.lost_item_id),
      foundItem: FoundItems.getById(m.found_item_id),
    }));
    res.json({ ...result, items: enriched });
  } catch (e) { next(e); }
});

router.get('/:id', requireAuth, (req, res, next) => {
  try {
    const match = Matches.getById(req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    const lostItem = LostItems.getById(match.lost_item_id);
    if (req.user.role === 'PASSENGER' && lostItem.user_id !== req.user.sub) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json({ match: { ...match, lostItem, foundItem: FoundItems.getById(match.found_item_id) } });
  } catch (e) { next(e); }
});

// GET /matches/:id/ownership-verification - the current verification
// record tied to this match (used by the passenger UI to know which
// record to submit proof against, without exposing other users' data).
router.get('/:id/ownership-verification', requireAuth, (req, res, next) => {
  try {
    const match = Matches.getById(req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    const lostItem = LostItems.getById(match.lost_item_id);
    if (req.user.role === 'PASSENGER' && lostItem.user_id !== req.user.sub) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const records = OwnershipVerifications.listForMatch(match.id);
    res.json({ ownershipVerification: records[0] || null });
  } catch (e) { next(e); }
});

// PUT /matches/:id - staff confirms or rejects a possible match.
// Confirming NEVER returns the item automatically - it only advances the
// match to OWNERSHIP_PENDING and kicks off ownership verification.
const reviewSchema = z.object({
  action: z.enum(['CONFIRM', 'REJECT']),
  notes: z.string().optional(),
});

router.put('/:id', requireAuth, requireRole('STAFF', 'ADMIN'), validate(reviewSchema), async (req, res, next) => {
  try {
    const match = Matches.getById(req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    const lostItem = LostItems.getById(match.lost_item_id);
    const foundItem = FoundItems.getById(match.found_item_id);

    if (req.body.action === 'REJECT') {
      Matches.updateStatus(match.id, 'STAFF_REJECTED', req.user.sub);
      LostItems.setStatus(lostItem.id, 'SEARCHING');
      await notify(lostItem.user_id, 'MATCH_REJECTED', {
        reportNumber: lostItem.report_number, relatedEntityType: 'MATCH', relatedEntityId: match.id,
      });
      audit(req, { action: 'MATCH_REJECTED', entityType: 'MATCH', entityId: match.id });
      return res.json({ match: Matches.getById(match.id) });
    }

    // CONFIRM
    Matches.updateStatus(match.id, 'OWNERSHIP_PENDING', req.user.sub);
    LostItems.setStatus(lostItem.id, 'OWNERSHIP_VERIFICATION');
    FoundItems.setStatus(foundItem.id, 'OWNERSHIP_VERIFICATION');
    const verification = OwnershipVerifications.create({
      matchId: match.id, lostItemId: lostItem.id, passengerId: lostItem.user_id,
    });
    await notify(lostItem.user_id, 'OWNERSHIP_VERIFICATION_REQUESTED', {
      reportNumber: lostItem.report_number, relatedEntityType: 'OWNERSHIP_VERIFICATION', relatedEntityId: verification.id,
    });
    audit(req, { action: 'MATCH_CONFIRMED', entityType: 'MATCH', entityId: match.id });
    res.json({ match: Matches.getById(match.id), ownershipVerification: verification });
  } catch (e) { next(e); }
});

module.exports = router;
