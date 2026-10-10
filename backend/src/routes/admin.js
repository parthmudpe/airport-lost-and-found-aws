const express = require('express');
const { z } = require('zod');
const { Users } = require('../db/repository');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const validate = require('../middleware/validate');
const { audit } = require('../services/auditService');

const router = express.Router();

router.use(requireAuth, requireRole('ADMIN'));

// GET /admin/users
router.get('/users', (req, res, next) => {
  try {
    const { role } = req.query;
    const users = Users.list({ role }).map(publicUser);

    res.json({ users });
  } catch (err) {
    next(err);
  }
});

const setActiveSchema = z.object({
  isActive: z.boolean(),
});

// PUT /admin/users/:id/active
router.put(
  '/users/:id/active',
  validate(setActiveSchema),
  (req, res, next) => {
    try {
      const user = Users.getById(req.params.id);

      if (!user) {
        return res.status(404).json({
          error: 'User not found',
        });
      }

      const { isActive } = req.body;

      // Prevent an administrator from deactivating their own account.
      if (!isActive && String(user.id) === String(req.user.sub)) {
        return res.status(409).json({
          error: 'You cannot deactivate your own admin account.',
        });
      }

      // Prevent removal of the last active administrator.
      if (
        !isActive &&
        user.role === 'ADMIN' &&
        user.is_active
      ) {
        const otherActiveAdmins = Users.list({ role: 'ADMIN' })
          .filter(
            (admin) =>
              admin.is_active &&
              String(admin.id) !== String(user.id)
          );

        if (otherActiveAdmins.length === 0) {
          return res.status(409).json({
            error: 'Cannot deactivate the last active administrator. Activate another admin first.',
          });
        }
      }

      const updated = Users.setActive(user.id, isActive);

      if (!updated) {
        return res.status(404).json({
          error: 'User not found',
        });
      }

      audit(req, {
        action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        entityType: 'USER',
        entityId: user.id,
      });

      return res.json({
        user: publicUser(updated),
      });
    } catch (err) {
      next(err);
    }
  }
);

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    phone: user.phone,
    role: user.role,
    airportId: user.airport_id,
    isActive: !!user.is_active,
    createdAt: user.created_at,
  };
}

module.exports = router;