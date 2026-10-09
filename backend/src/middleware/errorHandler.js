function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found' });
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || 500;
  if (status >= 500) {
    console.error(err);
  }
  res.status(status).json({
    error: err.publicMessage || err.message || 'Internal server error',
    ...(err.details ? { details: err.details } : {}),
  });
}

module.exports = { notFoundHandler, errorHandler };
