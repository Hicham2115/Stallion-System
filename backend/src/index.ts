import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';

process.on('unhandledRejection', (err: unknown) => { console.error('[unhandledRejection]', err); });
process.on('uncaughtException', (err: Error) => { console.error('[uncaughtException]', err.message); });

import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import clientRoutes from './routes/clients';
import paymentRoutes from './routes/payments';
import expenseRoutes from './routes/expenses';
import leadRoutes from './routes/leads';
import taskRoutes from './routes/tasks';
import dashboardRoutes from './routes/dashboard';
import serviceRoutes from './routes/services';
import chatRoutes from './routes/chat';
import portalRoutes from './routes/portal';
import portalAdminRoutes from './routes/portalAdmin';
import currencyRoutes from './routes/currency';
import meetingRoutes from './routes/meetings';
import crmRoutes from './routes/crm';
import { initSocket } from './socket';
import { errorHandler, notFound } from './middleware/errorHandler';
import { syncRates, loadRatesFromDB } from './lib/currency';
import { schedule as cronSchedule } from 'node-cron';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Init Socket.io
initSocket(httpServer);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Rate limiting
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: process.env.NODE_ENV === 'production' ? 500 : 5000, message: 'Too many requests' }));

// Logging & parsing
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/portal-admin', portalAdminRoutes);
app.use('/api/currency', currencyRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/crm', crmRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

httpServer.listen(PORT, async () => {
  console.log(`\n🐎 Stallion API running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
  await loadRatesFromDB();
  await syncRates();
  // Sync exchange rates every 6 hours
  cronSchedule('0 */6 * * *', () => { syncRates(); });
});

export default app;
