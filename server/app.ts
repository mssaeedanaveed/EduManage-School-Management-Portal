import express, { Request, Response, NextFunction } from 'express';
import authRoutes from './routes/authRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import teacherRoutes from './routes/teacherRoutes.js';
import classRoutes from './routes/classRoutes.js';
import subjectRoutes from './routes/subjectRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import resultRoutes from './routes/resultRoutes.js';
import timetableRoutes from './routes/timetableRoutes.js';
import feeRoutes from './routes/feeRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import databaseRoutes from './routes/databaseRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { initCronJobs } from './services/feeCronService.js';
import { initResultReminderJobs } from './services/resultReminderService.js';
import mongoSync from './services/mongoSync.js';

export function createServerApp() {
  const app = express();

  // Initialize automated cron services
  try {
    initCronJobs();
  } catch (e) {
    console.warn('[FeeCron] Cron initialization failed:', e);
  }
  try {
    initResultReminderJobs();
  } catch (e) {
    console.warn('[ResultReminder] Cron initialization failed:', e);
  }

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/api', (req, res, next) => {

    const sendJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (!mongoSync.isConnected()) {
        return sendJson(body);
      }
      void mongoSync.flushPendingWrites().then(
        () => sendJson(body),
        (error: unknown) => {
          console.error('[MongoDB] Request was not confirmed because persistence failed:', error);
          if (!res.headersSent) {
            res.status(503);
            sendJson({
              success: false,
              message: 'MongoDB could not save this change. Please verify the connection and retry.',
            });
          }
        }
      );
      return res;
    }) as typeof res.json;

    if (req.method === 'GET' && !['/api/health', '/api/database'].some((path) =>
      req.originalUrl.split('?')[0].startsWith(path)
    )) {
      if (!mongoSync.isConnected()) {
        next();
        return;
      }
      void mongoSync.refreshPortalCache().then(
        next,
        (error: unknown) => {
          console.error('[MongoDB] Could not refresh portal data:', error);
          if (!res.headersSent) {
            res.status(503).json({
              success: false,
              message: 'MongoDB could not refresh portal data. Please verify the database connection.',
            });
          }
        }
      );
      return;
    }
    next();
  });

  // API status health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Mount API modules
  app.use('/api/auth', authRoutes);
  app.use('/api/students', studentRoutes);
  app.use('/api/teachers', teacherRoutes);
  app.use('/api/teacher', teacherRoutes);
  app.use('/api/classes', classRoutes);
  app.use('/api/subjects', subjectRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/results', resultRoutes);
  app.use('/api/timetable', timetableRoutes);
  app.use('/api/fees', feeRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/database', databaseRoutes);

  // 404 handler for unknown API routes
  app.use('/api/*', (req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
    });
  });

  // Global Error Handler
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    console.error('[SERVER ERROR]', err);
    const status = err?.code === 'LIMIT_FILE_SIZE' || err?.code === 'LIMIT_UNEXPECTED_FILE'
      ? 400
      : (err.status || err.statusCode || 500);
    res.status(status).json({
      success: false,
      message: err.message || 'Internal Server Error',
    });
  });

  return app;
}

export const serverApp = createServerApp();
export default serverApp;
