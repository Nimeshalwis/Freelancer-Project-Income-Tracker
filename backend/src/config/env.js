import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

const jwtSecret = process.env.JWT_SECRET || '';
if (Buffer.byteLength(jwtSecret) < 32 || /replace|change.?me|your.?secret|placeholder/i.test(jwtSecret)) {
  throw new Error('JWT_SECRET must be a private random secret of at least 32 bytes. Configure backend/.env.');
}
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '15m';
const duration = /^([1-9]\d*)(s|m|h|d)$/.exec(jwtExpiresIn);
const seconds = duration ? Number(duration[1]) * ({ s: 1, m: 60, h: 3600, d: 86400 }[duration[2]]) : 0;
if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > 604800) {
  throw new Error('JWT_EXPIRES_IN must include a unit (s, m, h, d) and be between 1 second and 7 days.');
}

const port = Number(process.env.PORT || 5000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret,
  jwtExpiresIn,
  jwtIssuer: 'freelancer-project-income-tracker',
  jwtAudience: 'freelancer-project-income-tracker-api',
};
