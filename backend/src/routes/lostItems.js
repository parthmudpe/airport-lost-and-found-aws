const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const { LostItems, FoundItems, Matches, Airports } = require('../db/repository');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const validate = require('../middleware/validate');
const storageService = require('../services/storageService');
const { notify } = require('../services/notificationService');
const { findCandidateMatches } = require('../services/matchingService');
const { audit } = require('../services/auditService');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const lostItemSchema = z.object({
  category: z.string().min(1),
  itemName: z.string().min(1),
  description: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  color: z.string().optional(),
  serialNumber: z.string().optional(),
  uniqueFeatures: z.string().optional(),
  dateLost: z.string().min(1),
  timeLost: z.string().optional(),
  airportId: z.string().min(1),
  terminal: z.string().optional(),
  locationArea: z.string().optional(),
  flightNumber: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  additionalNotes: z.string().optional(),
});

// Find and save potential matches for a lost report.
async function generateMatchesForLostItem(lostItem) {
  const foundItems = FoundItems.listAll().filter(
    (f) =>
      f.airport_id === lostItem.airport_id &&
      ['FOUND', 'IN_STORAGE', 'POSSIBLE_MATCH'].includes(f.status)
  );

  const candidates = findCandidateMatches(lostItem, foundItems);
  const created = [];

  for (const candidate of candidates) {
    if (Matches.existsFor(lostItem.id, candidate.foundItem.id)) {
      continue;
    }

    const match = Matches.create({
      lostItemId: lostItem.id,
      foundItemId: candidate.foundItem.id,
      score: candidate.score,
      confidence: candidate.confidence,
      reasons: candidate.reasons,
      differences: candidate.differences,
    });

    created.push(match);
  }

  if (created.length > 0) {
    LostItems.setStatus(lostItem.id, 'POSSIBLE_MATCH');
    FoundItems.setStatus(created[0].found_item_id, 'POSSIBLE_MATCH');

    await notify(lostItem.user_id, 'POSSIBLE_MATCH_FOUND', {
      reportNumber: lostItem.report_number,
      confidence: created[0].confidence,
      relatedEntityType: 'MATCH',
      relatedEntityId: created[0].id,
    });
  }

  return created;
}

// POST /lost-items
// Passenger creates a lost-item report, optionally with images.
router.post(
  '/',
  requireAuth,
  requireRole('PASSENGER'),
  upload.array('images', 5),
  validate(lostItemSchema),
  async (req, res, next) => {
    try {
      if (!Airports.getById(req.body.airportId)) {
        const err = new Error('Unknown airportId');
        err.status = 400;
        throw err;
      }

      const images = [];

      for (const file of req.files || []) {
        const key = await storageService.saveFile(
          file,
          `lost-items/${req.user.sub}`
        );
        images.push(key);
      }

      const item = LostItems.create({
        ...req.body,
        userId: req.user.sub,
        images,
      });

      audit(req, {
        action: 'LOST_REPORT_CREATED',
        entityType: 'LOST_ITEM',
        entityId: item.id,
      });

      await notify(req.user.sub, 'LOST_REPORT_SUBMITTED', {
        reportNumber: item.report_number,
        itemName: item.item_name,
        relatedEntityType: 'LOST_ITEM',
        relatedEntityId: item.id,
      });

      await generateMatchesForLostItem(item);

      res.status(201).json({
        lostItem: LostItems.getById(item.id),
      });
    } catch (e) {
      next(e);
    }
  }
);

// GET /lost-items
// Passengers see only their own reports.
// Staff and admins can search and paginate reports.
router.get('/', requireAuth, (req, res, next) => {
  try {
    if (req.user.role === 'PASSENGER') {
      return res.json({
        items: LostItems.listByUser(req.user.sub),
      });
    }

    const {
      category,
      brand,
      model,
      color,
      airportId,
      terminal,
      status,
      dateFrom,
      dateTo,
      q,
      page,
      pageSize,
    } = req.query;

    const result = LostItems.search({
      category,
      brand,
      model,
      color,
      airportId,
      terminal,
      status,
      dateFrom,
      dateTo,
      q,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });

    res.json(result);
  } catch (e) {
    next(e);
  }
});

// GET /lost-items/:id
router.get('/:id', requireAuth, (req, res, next) => {
  try {
    const item = LostItems.getById(req.params.id);

    if (!item) {
      return res.status(404).json({ error: 'Lost item not found' });
    }

    if (
      req.user.role === 'PASSENGER' &&
      item.user_id !== req.user.sub
    ) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({ lostItem: item });
  } catch (e) {
    next(e);
  }
});

const updateSchema = lostItemSchema.partial().extend({
  status: z.enum([
    'REPORTED',
    'SEARCHING',
    'POSSIBLE_MATCH',
    'MATCH_CONFIRMED',
    'OWNERSHIP_VERIFICATION',
    'RETURNED',
    'CLOSED',
    'REJECTED',
  ]).optional(),
});

// PUT /lost-items/:id
router.put('/:id', requireAuth, validate(updateSchema), (req, res, next) => {
  try {
    const item = LostItems.getById(req.params.id);

    if (!item) {
      return res.status(404).json({ error: 'Lost item not found' });
    }

    if (req.user.role === 'PASSENGER') {
      if (item.user_id !== req.user.sub) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Passengers cannot change report status directly.
      delete req.body.status;
    }

    const updated = LostItems.update(req.params.id, req.body);

    audit(req, {
      action: 'LOST_ITEM_UPDATED',
      entityType: 'LOST_ITEM',
      entityId: item.id,
      metadata: { fields: Object.keys(req.body) },
    });

    res.json({ lostItem: updated });
  } catch (e) {
    next(e);
  }
});

// DELETE /lost-items/:id
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const item = LostItems.getById(req.params.id);

    if (!item) {
      return res.status(404).json({ error: 'Lost item not found' });
    }

    if (
      req.user.role === 'PASSENGER' &&
      item.user_id !== req.user.sub
    ) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // FIX: Delete the database record FIRST.
    // If the database delete fails, the photos are preserved.
    LostItems.delete(req.params.id);

    // Only clean up S3 photos after the database delete succeeds.
    // A failed S3 cleanup may leave an orphaned file, but will not
    // leave an existing database record pointing to a deleted photo.
    for (const key of item.images || []) {
      try {
        await storageService.deleteFile(key);
      } catch (storageError) {
        console.error(
          `Could not delete S3 photo for lost item ${item.id}:`,
          storageError.message
        );
      }
    }

    audit(req, {
      action: 'LOST_ITEM_DELETED',
      entityType: 'LOST_ITEM',
      entityId: item.id,
    });

    return res.status(204).send();
  } catch (e) {
    next(e);
  }
});

// GET /lost-items/:id/matches
router.get('/:id/matches', requireAuth, (req, res, next) => {
  try {
    const item = LostItems.getById(req.params.id);

    if (!item) {
      return res.status(404).json({ error: 'Lost item not found' });
    }

    if (
      req.user.role === 'PASSENGER' &&
      item.user_id !== req.user.sub
    ) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const matches = Matches.listForLostItem(item.id).map((match) => {
      const found = FoundItems.getById(match.found_item_id);

      // Passengers must not see the full serial number or storage location.
      const safeFound =
        req.user.role === 'PASSENGER' && found
          ? {
              ...found,
              serial_number: found.serial_number
                ? maskSerial(found.serial_number)
                : null,
              storage_location: undefined,
            }
          : found;

      return {
        ...match,
        foundItem: safeFound,
      };
    });

    res.json({ matches });
  } catch (e) {
    next(e);
  }
});

function maskSerial(serial) {
  if (serial.length <= 4) {
    return '*'.repeat(serial.length);
  }

  return `${'*'.repeat(serial.length - 4)}${serial.slice(-4)}`;
}

module.exports = router;
module.exports.generateMatchesForLostItem = generateMatchesForLostItem;