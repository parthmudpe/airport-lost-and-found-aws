const express = require('express');
const { z } = require('zod');
const { Users } = require('../db/repository');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const validate = require('../middleware/validate');
const { audit } = require('../services/auditService');

const router = express.Router();
router.use(requireAuth, requireRole('ADMIN'));

router.get('/users', (req, res, next) => {
  try {
    const { role } = req.query;
    const users = Users.list({ role }).map(publicUser);
    res.json({ users });
  } catch (e) { next(e); }
});

const setActiveSchema = z.object({ isActive: z.boolean() });

router.put('/users/:id/active', validate(setActiveSchema), (req, res, next) => {
  try {
    const user = Users.getById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const updated = Users.setActive(req.params.id, req.body.isActive);
    audit(req, { action: req.body.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', entityType: 'USER', entityId: user.id });
    res.json({ user: publicUser(updated) });
  } catch (e) { next(e); }
});

function publicUser(u) {
  return {
    id: u.id, email: u.email, fullName: u.full_name, phone: u.phone,
    role: u.role, airportId: u.airport_id, isActive: !!u.is_active, createdAt: u.created_at,
  };
}

module.exports = router;
