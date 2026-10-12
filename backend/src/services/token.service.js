import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signAccessToken(user) {
  return jwt.sign({}, env.jwtSecret, {
    algorithm: 'HS256', subject: user._id.toString(), expiresIn: env.jwtExpiresIn,
    issuer: env.jwtIssuer, audience: env.jwtAudience,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtSecret, {
    algorithms: ['HS256'], issuer: env.jwtIssuer, audience: env.jwtAudience,
  });
}
