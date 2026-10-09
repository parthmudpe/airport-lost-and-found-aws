const express = require('express');
const { AuditLogs } = require('../db/repository');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

router.get('/', requireAuth, requireRole('ADMIN', 'STAFF'), (req, res, next) => {
  try {
    const { page, pageSize, entityType, userId } = req.query;
    const result = AuditLogs.list({
      page: page ? +page : 1, pageSize: pageSize ? +pageSize : 50, entityType, userId,
    });
    res.json(result);
  } catch (e) { next(e); }
});

module.exports = router;
