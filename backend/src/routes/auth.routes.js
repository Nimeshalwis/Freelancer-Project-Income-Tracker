import { Router } from 'express';
import { register, login, getMe } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { validateCredentials } from '../middleware/auth-validation.middleware.js';
import { loginLimiter, registerLimiter } from '../middleware/auth-rate-limit.middleware.js';

const router = Router();
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.post('/register', registerLimiter, validateBody({ name: 'string', email: 'string', password: 'string' }), validateCredentials, register);
router.post('/login', loginLimiter, validateBody({ email: 'string', password: 'string' }), validateCredentials, login);
router.get('/me', authenticate, getMe);
export default router;
