import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import healthRoutes from './routes/health.routes.js';
import clientRoutes from './routes/client.routes.js';
import projectRoutes from './routes/project.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import authRoutes from './routes/auth.routes.js';
import { authenticate } from './middleware/auth.middleware.js';
import { errorHandler, notFound } from './middleware/error.middleware.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.clientOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/clients', authenticate, clientRoutes);
app.use('/api/projects', authenticate, projectRoutes);
app.use('/api/payments', authenticate, paymentRoutes);
app.use('/api/dashboard', authenticate, dashboardRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
