
const express = require('express');
const fs = require('fs');
const { requireAuth } = require('../middleware/auth');
const storageService = require('../services/storageService');

const router = express.Router();

function canAccess(user, key) {
  if (user.role === 'STAFF' || user.role === 'ADMIN') {
    return true;
  }

  const parts = key.split('/');
  return parts.length >= 3 && parts[1] === user.sub;
}

function validImageKey(key) {
  if (typeof key !== 'string' || key.includes('..') || key.includes('\\')) {
    return false;
  }

  const parts = key.split('/');
  return (
    parts.length === 3 &&
    ['lost-items', 'found-items'].includes(parts[0]) &&
    parts.every((part) => part.length > 0) &&
    /\.(jpg|jpeg|png|webp)$/i.test(parts[2])
  );
}

// Return a short-lived S3 URL after checking the current user's access.
// For local storage, the frontend downloads the image through the
// authenticated file route instead.
router.get('/signed-url', requireAuth, async (req, res, next) => {
  try {
    const key = req.query.key;

    if (!validImageKey(key)) {
      return res.status(400).json({ error: 'Invalid image key.' });
    }

    if (!canAccess(req.user, key)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (storageService.provider !== 's3') {
      return res.json({ mode: 'proxy' });
    }

    const url = await storageService.getSignedUrl(key);
    return res.json({ mode: 'signed', url });
  } catch (err) {
    return next(err);
  }
});

// Storage keys look like <kind>/<ownerUserId>/<generated-filename>.
// Staff/admin may access any file; passengers may access only their own.
router.get('/:key(*)', requireAuth, async (req, res, next) => {
  try {
    const key = req.params.key;

    if (key.includes('..') || key.includes('\\')) {
      return res.status(400).json({ error: 'Invalid key' });
    }

    if (!canAccess(req.user, key)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (storageService.provider === 's3') {
      return res.redirect(302, await storageService.getSignedUrl(key));
    }

    const filePath = storageService.resolvePath(key);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    return res.sendFile(filePath);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
