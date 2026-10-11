function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found' });
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'File too large. Maximum image size is 8 MB.',
    });
  }

  if (err?.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      error: 'Too many images or unexpected upload field. Upload at most 5 images.',
    });
  }

  const status = err.status || 500;

  if (status >= 500) {
    console.error(err);
  }

  return res.status(status).json({
    error: err.publicMessage || err.message || 'Internal server error',
    ...(err.details ? { details: err.details } : {}),
  });
}

module.exports = { notFoundHandler, errorHandler };