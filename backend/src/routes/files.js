const express = require('express');
const fs = require('fs');
const { requireAuth } = require('../middleware/auth');
const storageService = require('../services/storageService');

// File access. Storage keys look like <kind>/<ownerUserId>/<uuid>.<ext>.
// - STAFF/ADMIN may open any file.
// - PASSENGERS may open only files under their own user id (their own
//   report photos and ownership-proof documents).
// Local mode streams the file; S3 mode redirects (302) to a short-lived
// pre-signed URL, so the bucket itself is never public.
const router = express.Router();

function canAccess(user, key) {
  if (user.role === 'STAFF' || user.role === 'ADMIN') return true;
  const parts = key.split('/');
  return parts.length >= 3 && parts[1] === user.sub;
}

router.get('/:key(*)', requireAuth, async (req, res, next) => {
  try {
    const key = req.params.key;
    if (key.includes('..')) return res.status(400).json({ error: 'Invalid key' });
    if (!canAccess(req.user, key)) return res.status(403).json({ error: 'Forbidden' });

    if (storageService.provider === 's3') {
      return res.redirect(302, await storageService.getSignedUrl(key));
    }
    const filePath = storageService.resolvePath(key);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.sendFile(filePath);
  } catch (e) { next(e); }
});

module.exports = router;
