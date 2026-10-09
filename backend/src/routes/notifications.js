const express = require('express');
const { Notifications } = require('../db/repository');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res, next) => {
  try {
    const unreadOnly = req.query.unreadOnly === 'true';
    res.json({ notifications: Notifications.listForUser(req.user.sub, { unreadOnly }) });
  } catch (e) { next(e); }
});

router.put('/:id/read', requireAuth, (req, res, next) => {
  try {
    const n = Notifications.getById(req.params.id);
    if (!n) return res.status(404).json({ error: 'Not found' });
    if (n.user_id !== req.user.sub) return res.status(403).json({ error: 'Forbidden' });
    res.json({ notification: Notifications.markRead(req.params.id) });
  } catch (e) { next(e); }
});

module.exports = router;
