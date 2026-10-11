const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const { FoundItems, LostItems, Matches, Airports } = require('../db/repository');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const validate = require('../middleware/validate');
const storageService = require('../services/storageService');
const { notify } = require('../services/notificationService');
const { findCandidateMatches } = require('../services/matchingService');
const { audit } = require('../services/auditService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const foundItemSchema = z.object({
  category: z.string().min(1),
  itemName: z.string().min(1),
  description: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  color: z.string().optional(),
  serialNumber: z.string().optional(),
  uniqueFeatures: z.string().optional(),
  dateFound: z.string().min(1),
  timeFound: z.string().optional(),
  airportId: z.string().min(1),
  terminal: z.string().optional(),
  locationArea: z.string().optional(),
  storageLocation: z.string().optional(),
});

// Reverse-direction matching: when staff register a found item, look for
// existing lost reports it might match, using the same shared engine.
async function generateMatchesForFoundItem(foundItem) {
  const lostReports = LostItems.search({ airportId: foundItem.airport_id, category: foundItem.category, pageSize: 200 }).items
    .filter((l) => ['REPORTED', 'SEARCHING', 'POSSIBLE_MATCH'].includes(l.status));
  const created = [];
  for (const lost of lostReports) {
    if (Matches.existsFor(lost.id, foundItem.id)) continue;
    const { compareItems } = require('../services/matchingService');
    const result = compareItems(lost, foundItem);
    if (!result.confidence) continue;
    const match = Matches.create({
      lostItemId: lost.id, foundItemId: foundItem.id,
      score: result.score, confidence: result.confidence,
      reasons: result.reasons, differences: result.differences,
    });
    created.push(match);
    LostItems.setStatus(lost.id, 'POSSIBLE_MATCH');
    await notify(lost.user_id, 'POSSIBLE_MATCH_FOUND', {
      reportNumber: lost.report_number, confidence: result.confidence,
      relatedEntityType: 'MATCH', relatedEntityId: match.id,
    });
  }
  if (created.length > 0) FoundItems.setStatus(foundItem.id, 'POSSIBLE_MATCH');
  return created;
}

router.post('/', requireAuth, requireRole('STAFF', 'ADMIN'), upload.array('images', 5), validate(foundItemSchema), async (req, res, next) => {
  try {
    if (!Airports.getById(req.body.airportId)) {
      const err = new Error('Unknown airportId'); err.status = 400; throw err;
    }
    const images = [];
    for (const file of req.files || []) {
      const key = await storageService.saveFile(file, `found-items/${req.user.sub}`);
      images.push(key);
    }
    const item = FoundItems.create({ ...req.body, foundByStaffId: req.user.sub, images });
    audit(req, { action: 'FOUND_ITEM_REGISTERED', entityType: 'FOUND_ITEM', entityId: item.id });
    await generateMatchesForFoundItem(item);
    res.status(201).json({ foundItem: FoundItems.getById(item.id) });
  } catch (e) { next(e); }
});

router.get('/', requireAuth, requireRole('STAFF', 'ADMIN'), (req, res, next) => {
  try {
    const { category, brand, model, color, airportId, terminal, status, q, page, pageSize } = req.query;
    const result = FoundItems.search({
      category, brand, model, color, airportId, terminal, status, q,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
    res.json(result);
  } catch (e) { next(e); }
});

router.get('/:id', requireAuth, requireRole('STAFF', 'ADMIN'), (req, res, next) => {
  try {
    const item = FoundItems.getById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Found item not found' });
    res.json({ foundItem: item });
  } catch (e) { next(e); }
});

const updateSchema = foundItemSchema.partial().extend({
  status: z.enum(['FOUND', 'IN_STORAGE', 'POSSIBLE_MATCH', 'CLAIM_PENDING', 'OWNERSHIP_VERIFICATION', 'RETURNED', 'UNCLAIMED', 'CLOSED']).optional(),
});

router.put('/:id', requireAuth, requireRole('STAFF', 'ADMIN'), validate(updateSchema), (req, res, next) => {
  try {
    const item = FoundItems.getById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Found item not found' });
    const updated = FoundItems.update(req.params.id, req.body);
    audit(req, { action: 'FOUND_ITEM_UPDATED', entityType: 'FOUND_ITEM', entityId: item.id, metadata: { fields: Object.keys(req.body) } });
    res.json({ foundItem: updated });
  } catch (e) { next(e); }
});

module.exports = router;
module.exports.generateMatchesForFoundItem = generateMatchesForFoundItem;
