import { ApiError } from '../utils/ApiError.js';

export const isObjectId = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);

function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return false;
  const day = Date.parse(value.slice(0, 10));
  return Number.isFinite(day) && new Date(day).toISOString().slice(0, 10) === value.slice(0, 10) && Number.isFinite(Date.parse(value));
}

export function validateId(req, _res, next) {
  if (!isObjectId(req.params.id)) throw new ApiError(400, 'Invalid record ID. Expected a 24-character hexadecimal ObjectId.');
  next();
}

// Reject operators, unknown fields, and implicit Mongoose type coercion at the API boundary.
export function validateBody(fields) {
  return (req, _res, next) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length) {
      throw new ApiError(400, 'Request body must be a non-empty JSON object.');
    }
    const errors = [];
    for (const [field, value] of Object.entries(body)) {
      const type = Object.hasOwn(fields, field) ? fields[field] : undefined;
      if (!type) errors.push({ field, message: 'Unknown or read-only field.' });
      else if (type === 'id' && !isObjectId(value)) errors.push({ field, message: 'Must be a valid ObjectId string.' });
      else if (type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) errors.push({ field, message: 'Must be a finite JSON number.' });
      else if (type === 'string' && typeof value !== 'string') errors.push({ field, message: 'Must be a string.' });
      else if (type === 'date' && !isIsoDate(value)) {
        errors.push({ field, message: 'Must be an ISO date string.' });
      }
    }
    if (errors.length) throw new ApiError(400, 'Invalid request body.', errors);
    next();
  };
}
