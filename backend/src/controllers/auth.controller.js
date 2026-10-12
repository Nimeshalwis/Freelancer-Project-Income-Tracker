import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import User from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { signAccessToken } from '../services/token.service.js';

// Equal-cost comparison for unknown accounts, without a hardcoded password/hash.
const dummyHash = bcrypt.hash(randomBytes(32).toString('base64url'), 12);
const respondWithToken = (res, user, status) => {
  res.set('Cache-Control', 'no-store');
  res.status(status).json({ success: true, data: { user: user.toObject(), token: signAccessToken(user), tokenType: 'Bearer' } });
};

export async function register(req, res) {
  let user;
  try {
    await User.init(); // Wait for the unique email index before accepting registrations.
    user = await User.create({ name: req.body.name, email: req.body.email, password: req.body.password });
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, 'Email is already registered.');
    throw error;
  }
  respondWithToken(res, user, 201);
}

export async function login(req, res) {
  const user = await User.findOne({ email: req.body.email }).select('+password');
  const matches = user ? await user.comparePassword(req.body.password) : await bcrypt.compare(req.body.password, await dummyHash);
  if (!user || !matches) throw new ApiError(401, 'Invalid email or password.');
  respondWithToken(res, user, 200);
}

export function getMe(req, res) {
  res.json({ success: true, data: { user: req.user.toObject() } });
}
