const express = require('express');
const { z } = require('zod');
const { Airports } = require('../db/repository');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const validate = require('../middleware/validate');
const { audit } = require('../services/auditService');

const router = express.Router();

// Public-ish list (still requires login) so passengers can pick an airport on the report form.
router.get('/', requireAuth, (req, res, next) => {
  try { res.json({ airports: Airports.list() }); } catch (e) { next(e); }
});

const createSchema = z.object({
  code: z.string().min(3).max(4),
  name: z.string().min(2),
  city: z.string().optional(),
  country: z.string().optional(),
  terminals: z.array(z.string()).optional(),
});

router.post('/', requireAuth, requireRole('ADMIN'), validate(createSchema), (req, res, next) => {
  try {
    const airport = Airports.create(req.body);
    audit(req, { action: 'AIRPORT_CREATED', entityType: 'AIRPORT', entityId: airport.id });
    res.status(201).json({ airport });
  } catch (e) { next(e); }
});

module.exports = router;
