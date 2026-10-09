const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const { OwnershipVerifications, LostItems, FoundItems, Matches } = require('../db/repository');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const validate = require('../middleware/validate');
const storageService = require('../services/storageService');
const { notify } = require('../services/notificationService');
const { audit } = require('../services/auditService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

router.get('/:id', requireAuth, (req, res, next) => {
  try {
    const record = OwnershipVerifications.getById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Not found' });
    if (req.user.role === 'PASSENGER' && record.passenger_id !== req.user.sub) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json({ ownershipVerification: record });
  } catch (e) { next(e); }
});

// PUT /ownership-verification/:id - passenger submits proof (multipart: documents[] + fields)
const submitSchema = z.object({
  proofText: z.string().min(1, 'Please describe your ownership proof'),
  verificationMethod: z.enum(['SERIAL_NUMBER', 'IMEI', 'UNIQUE_FEATURE', 'PURCHASE_DETAILS', 'DOCUMENT', 'STAFF_QUESTION']).optional(),
});

router.put('/:id', requireAuth, requireRole('PASSENGER'), upload.array('documents', 5), async (req, res, next) => {
  try {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
      const err = new Error('Validation failed'); err.status = 400; err.details = parsed.error.flatten(); throw err;
    }
    const record = OwnershipVerifications.getById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Not found' });
    if (record.passenger_id !== req.user.sub) return res.status(403).json({ error: 'Forbidden' });

    const proofDocuments = [];
    for (const file of req.files || []) {
      const key = await storageService.saveFile(file, `ownership-proof/${req.user.sub}`);
      proofDocuments.push(key);
    }
    const updated = OwnershipVerifications.submitProof(record.id, { proofText: parsed.data.proofText, proofDocuments });
    audit(req, { action: 'OWNERSHIP_PROOF_SUBMITTED', entityType: 'OWNERSHIP_VERIFICATION', entityId: record.id });
    res.json({ ownershipVerification: updated });
  } catch (e) { next(e); }
});

// POST /ownership-verification/:id/review - staff approves/rejects.
// This is the ONLY path that can move an item to RETURNED-eligible state -
// never automatic from the matching score alone.
const reviewSchema = z.object({
  approved: z.boolean(),
  notes: z.string().optional(),
});

router.post('/:id/review', requireAuth, requireRole('STAFF', 'ADMIN'), validate(reviewSchema), async (req, res, next) => {
  try {
    const record = OwnershipVerifications.getById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Not found' });
    if (record.status !== 'SUBMITTED') {
      const err = new Error('Ownership proof has not been submitted yet'); err.status = 400; throw err;
    }
    const reviewed = OwnershipVerifications.review(record.id, { approved: req.body.approved, staffId: req.user.sub, notes: req.body.notes });
    const match = Matches.getById(record.match_id);
    const lostItem = LostItems.getById(record.lost_item_id);

    if (req.body.approved) {
      Matches.updateStatus(match.id, 'OWNERSHIP_VERIFIED', req.user.sub);
      LostItems.setStatus(lostItem.id, 'MATCH_CONFIRMED');
      FoundItems.setStatus(match.found_item_id, 'CLAIM_PENDING');
      await notify(record.passenger_id, 'OWNERSHIP_VERIFIED', { reportNumber: lostItem.report_number, relatedEntityType: 'OWNERSHIP_VERIFICATION', relatedEntityId: record.id });
      await notify(record.passenger_id, 'ITEM_READY_FOR_COLLECTION', {
        reportNumber: lostItem.report_number,
        airport: (require('../db/repository').Airports.getById(lostItem.airport_id) || {}).name || lostItem.airport_id,
        relatedEntityType: 'LOST_ITEM', relatedEntityId: lostItem.id,
      });
    } else {
      Matches.updateStatus(match.id, 'OWNERSHIP_REJECTED', req.user.sub);
      LostItems.setStatus(lostItem.id, 'SEARCHING');
      await notify(record.passenger_id, 'OWNERSHIP_REJECTED', { reportNumber: lostItem.report_number, relatedEntityType: 'OWNERSHIP_VERIFICATION', relatedEntityId: record.id });
    }
    audit(req, { action: 'OWNERSHIP_REVIEWED', entityType: 'OWNERSHIP_VERIFICATION', entityId: record.id, metadata: { approved: req.body.approved } });
    res.json({ ownershipVerification: reviewed });
  } catch (e) { next(e); }
});

// POST /ownership-verification/:id/mark-returned - staff completes the loop.
router.post('/:id/mark-returned', requireAuth, requireRole('STAFF', 'ADMIN'), async (req, res, next) => {
  try {
    const record = OwnershipVerifications.getById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Not found' });
    if (record.status !== 'STAFF_APPROVED') {
      const err = new Error('Ownership must be approved before marking returned'); err.status = 400; throw err;
    }
    const match = Matches.getById(record.match_id);
    const lostItem = LostItems.getById(record.lost_item_id);
    Matches.updateStatus(match.id, 'COMPLETED', req.user.sub);
    LostItems.setStatus(lostItem.id, 'RETURNED');
    FoundItems.setStatus(match.found_item_id, 'RETURNED');
    await notify(record.passenger_id, 'ITEM_RETURNED', { reportNumber: lostItem.report_number, relatedEntityType: 'LOST_ITEM', relatedEntityId: lostItem.id });
    audit(req, { action: 'ITEM_RETURNED', entityType: 'LOST_ITEM', entityId: lostItem.id });
    res.json({ lostItem: LostItems.getById(lostItem.id) });
  } catch (e) { next(e); }
});

module.exports = router;
