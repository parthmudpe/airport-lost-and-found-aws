const { AuditLogs } = require('../db/repository');

function audit(req, { action, entityType, entityId, metadata }) {
  AuditLogs.record({
    userId: req.user ? req.user.sub : null,
    role: req.user ? req.user.role : null,
    action,
    entityType,
    entityId,
    metadata,
  });
}

module.exports = { audit };
