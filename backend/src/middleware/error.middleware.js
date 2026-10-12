export function notFound(_req, res) {
  res.status(404).json({ success: false, message: 'API route not found.', errors: [] });
}

export function errorHandler(err, _req, res, _next) {
  let status = Number.isInteger(err.status) && err.status >= 400 && err.status <= 599 ? err.status : 500;
  let message = err.message;
  let errors = err.errors instanceof Array ? err.errors : [];
  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation failed.';
    errors = Object.values(err.errors).map((error) => ({ field: error.path, message: error.message }));
  } else if (err.name === 'CastError' || err.name === 'StrictModeError') {
    status = 400;
    message = 'Invalid field value.';
    errors = [{ field: err.path, message: 'Invalid value or unknown field.' }];
  } else if (err.code === 11000 || err.name === 'VersionError') {
    status = 409;
    message = 'Record conflict. Refresh and retry.';
  } else if (err.type === 'entity.parse.failed') {
    message = 'Malformed JSON request body.';
  } else if (err.code === 20 && /transaction/i.test(err.message)) {
    status = 503;
    message = 'Project and payment writes require MongoDB Atlas or a replica set with transaction support.';
  } else if (err.name === 'MongoServerSelectionError' || err.name === 'MongooseServerSelectionError') {
    status = 503;
    message = 'Database unavailable.';
  }
  res.status(status).json({ success: false, message: status === 500 ? 'Internal server error.' : message, errors });
}
