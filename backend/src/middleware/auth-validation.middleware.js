import { ApiError } from '../utils/ApiError.js';

export function validateCredentials(req, _res, next) {
  const { email, password } = req.body;
  if (!email || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new ApiError(400, 'Invalid email address.', [{ field: 'email', message: 'Provide a valid email address.' }]);
  }
  if (!password || Buffer.byteLength(password, 'utf8') > 72) {
    throw new ApiError(400, 'Invalid password.', [{ field: 'password', message: 'Password is required and must not exceed 72 UTF-8 bytes.' }]);
  }
  req.body.email = email.trim().toLowerCase();
  next();
}
