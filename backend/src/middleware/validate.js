// Generic zod-schema validation middleware.
// Usage: router.post('/x', validate(schema), handler)
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const err = new Error('Validation failed');
      err.status = 400;
      err.details = result.error.flatten();
      return next(err);
    }
    req[source] = result.data;
    next();
  };
}

module.exports = validate;
