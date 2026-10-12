import User from '../models/User.js';
import { verifyAccessToken } from '../services/token.service.js';
import { ApiError } from '../utils/ApiError.js';
import { isObjectId } from './validate.middleware.js';

export async function authenticate(req, res, next) {
  const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization || '');
  let payload;
  try {
    if (!match) throw new Error('Missing bearer token.');
    payload = verifyAccessToken(match[1]);
    if (!payload || typeof payload !== 'object' || !isObjectId(payload.sub) || !Number.isInteger(payload.exp) || !Number.isInteger(payload.iat)) throw new Error('Invalid claims.');
  } catch {
    res.set('WWW-Authenticate', 'Bearer');
    throw new ApiError(401, 'Authentication required. Provide a valid, unexpired Bearer token.');
  }
  const user = await User.findById(payload.sub);
  if (!user) {
    res.set('WWW-Authenticate', 'Bearer');
    throw new ApiError(401, 'Authentication required. User no longer exists.');
  }
  req.user = user;
  res.set('Cache-Control', 'no-store');
  next();
}
