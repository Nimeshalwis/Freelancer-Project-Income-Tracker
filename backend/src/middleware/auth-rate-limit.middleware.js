import { rateLimit } from 'express-rate-limit';

const options = {
  windowMs: 15 * 60 * 1000, standardHeaders: 'draft-8', legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ success: false, message: 'Too many authentication attempts. Try again later.', errors: [] }),
};
export const loginLimiter = rateLimit({ ...options, limit: 10 });
export const registerLimiter = rateLimit({ ...options, limit: 5 });
