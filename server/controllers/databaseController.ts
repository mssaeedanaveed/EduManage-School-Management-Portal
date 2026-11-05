import { Request, Response } from 'express';
import { connectDB, disconnectDB, getDbConnectionStatus, maskMongoUri } from '../config/db.js';
import mongoSync from '../services/mongoSync.js';
import dbMonitor from '../services/dbMonitor.js';
import store from '../data/store.js';

/**
 * Get live MongoDB connection status & collection counts
 */
export async function getStatus(_req: Request, res: Response): Promise<void> {
  try {
    const status = await getDbConnectionStatus();
    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to retrieve database status',
    });
  }
}

/**
 * Connect to MongoDB with either a full connection string or Atlas-required fields.
 */
export async function connect(req: Request, res: Response): Promise<void> {
  const { uri, username, password, host, databaseName } = req.body as {
    uri?: string;
    username?: string;
    password?: string;
    host?: string;
    databaseName?: string;
  };

  let cleanUri = typeof uri === 'string' ? uri.trim() : '';

  if (!cleanUri) {
    const requiredFields: string[] = [];
    if (!username || !String(username).trim()) requiredFields.push('database username');
    if (!password || !String(password).trim()) requiredFields.push('database password');
    if (!host || !String(host).trim()) requiredFields.push('cluster host or SRV hostname');
    if (!databaseName || !String(databaseName).trim()) requiredFields.push('database name');

    if (requiredFields.length) {
      res.status(400).json({
        success: false,
        message: `Missing required MongoDB Atlas details: ${requiredFields.join(', ')}.`,
      });
      return;
    }

    const normalizedHost = String(host).trim();
    const sanitizedHost = normalizedHost.replace(/^mongodb(?:\+srv)?:\/\//i, '').split('/')[0];
    const baseProtocol = sanitizedHost.includes('.mongodb.net') || normalizedHost.includes('mongodb+srv://') ? 'mongodb+srv://' : 'mongodb://';
    const encodedPassword = encodeURIComponent(String(password));
    const encodedUsername = encodeURIComponent(String(username).trim());
    const dbName = String(databaseName).trim();
    cleanUri = `${baseProtocol}${encodedUsername}:${encodedPassword}@${sanitizedHost}/${dbName}?retryWrites=true&w=majority`;
  }

  if (!cleanUri.startsWith('mongodb://') && !cleanUri.startsWith('mongodb+srv://')) {
    res.status(400).json({
      success: false,
      message: 'Invalid URI format. Connection string must start with "mongodb://" or "mongodb+srv://"',
    });
    return;
  }

  try {
    const result = await connectDB(cleanUri);
    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
        data: result.details,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
        details: result.details,
      });
    }
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to connect to MongoDB',
    });
  }
}

/**
 * Disconnect from MongoDB
 */
export async function disconnect(_req: Request, res: Response): Promise<void> {
  try {
    await disconnectDB();
    const status = await getDbConnectionStatus();
    res.status(200).json({
      success: true,
      message: 'Disconnected from MongoDB. Switched to embedded in-memory store.',
      data: status,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to disconnect from MongoDB',
    });
  }
}

/**
 * Sync data between memory store and MongoDB
 */
export async function syncDatabase(req: Request, res: Response): Promise<void> {
  const { direction = 'push' } = req.body; // 'push' to Mongo, or 'pull' from Mongo

  try {
    if (!mongoSync.isConnected()) {
      res.status(400).json({
        success: false,
        message: 'Cannot synchronize: MongoDB is not currently connected. Please connect your database first.',
      });
      return;
    }

    if (direction === 'pull') {
      const result = await mongoSync.pullAllFromMongo();
      res.status(200).json({
        success: true,
        message: 'Successfully pulled latest records from MongoDB into portal memory.',
        data: result,
      });
    } else {
      const result = await mongoSync.syncAllToMongo();
      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    }
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Synchronization failed',
    });
  }
}

/**
 * Re-seed the database
 */
export async function seedDatabase(_req: Request, res: Response): Promise<void> {
  try {
    store.resetToSeed();

    let mongoResult = null;
    if (mongoSync.isConnected()) {
      mongoResult = await mongoSync.syncAllToMongo(true);
    }

    dbMonitor.log({
      operation: 'SEED',
      collection: 'all_collections',
      details: 'Full school demo seed dataset reset and re-synchronized',
      status: 'success',
      durationMs: 5,
    });

    res.status(200).json({
      success: true,
      message: 'Database reset to clean factory seed state with all academic records.',
      mongoSynced: !!mongoResult,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to re-seed database',
    });
  }
}

/**
 * Get list of all collections with stats
 */
export async function getCollections(_req: Request, res: Response): Promise<void> {
  try {
    const status = await getDbConnectionStatus();
    res.status(200).json({
      success: true,
      data: status.collections,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch collections',
    });
  }
}

/**
 * Get paginated records from a specific collection (monitor in database)
 */
export async function getCollectionDocuments(req: Request, res: Response): Promise<void> {
  const { name } = req.params;
  const { page = '1', limit = '25', search } = req.query as {
    page?: string;
    limit?: string;
    search?: string;
  };

  try {
    const result = await mongoSync.getCollectionDocuments(name, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 25,
      search,
    });

    // Strip password hashes from user objects for security
    if (name.toLowerCase() === 'users') {
      result.documents = result.documents.map((d: any) => ({
        ...d,
        passwordHash: '•••••••••••• [Protected Bcrypt Hash]',
      }));
    }

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(404).json({
      success: false,
      message: err.message || 'Collection not found',
    });
  }
}

/**
 * Get live database activity logs
 */
export function getLogs(req: Request, res: Response): void {
  const { limit = '50', collection, operation, status } = req.query as {
    limit?: string;
    collection?: string;
    operation?: string;
    status?: string;
  };

  const logs = dbMonitor.getLogs({
    limit: parseInt(limit, 10) || 50,
    collection,
    operation,
    status,
  });

  res.status(200).json({
    success: true,
    total: logs.length,
    data: logs,
  });
}

/**
 * Clear operation logs
 */
export function clearLogs(_req: Request, res: Response): void {
  dbMonitor.clearLogs();
  res.status(200).json({
    success: true,
    message: 'Operation logs cleared.',
  });
}

/**
 * Get performance metrics
 */
export function getMetrics(_req: Request, res: Response): void {
  const metrics = dbMonitor.getMetrics();
  res.status(200).json({
    success: true,
    data: metrics,
  });
}

/**
 * Export full database JSON dump
 */
export function exportDatabase(_req: Request, res: Response): void {
  const dump = {
    exportedAt: new Date().toISOString(),
    school: 'EduManage Comprehensive School Management',
    mode: mongoSync.isConnected() ? 'mongodb' : 'embedded-store',
    collections: {
      users: store.getUsers().map((u) => ({ ...u, passwordHash: '[REDACTED]' })),
      classes: store.getClasses(),
      teachers: store.getTeachers(),
      subjects: store.getSubjects(),
      students: store.students,
      attendance: store.attendance,
      exams: store.exams,
      results: store.results,
      timetable: store.timetable,
      feeStructures: store.feeStructures,
      feePayments: store.feePayments,
    },
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=edumanage_db_dump_${Date.now()}.json`);
  res.status(200).json(dump);
}
