import { randomBytes } from 'node:crypto';

// Tests use disposable secrets, never application credentials.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = randomBytes(48).toString('base64url');
process.env.JWT_EXPIRES_IN = '15m';
