import 'dotenv/config';
import mongoose from 'mongoose';
import dbMonitor from '../services/dbMonitor.js';
import mongoSync from '../services/mongoSync.js';

let activeUri: string | null = process.env.MONGODB_URI || null;
let mongoWasConfigured = Boolean(activeUri);
let lastPingMs: number | null = null;
let connectionError: string | null = null;

export function isMongoConfigured(): boolean {
  return mongoWasConfigured || Boolean(process.env.MONGODB_URI?.trim());
}

// Helper to mask passwords in MongoDB URIs
export function maskMongoUri(uri: string): string {
  try {
    return uri.replace(
      /(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@.+)/i,
      '$1••••••••$3'
    );
  } catch {
    return 'mongodb://••••••••';
  }
}

// Setup connection lifecycle listeners
mongoose.connection.on('connected', () => {
  console.log('[DB] Mongoose connected to MongoDB.');
  connectionError = null;
  dbMonitor.log({
    operation: 'CONNECT',
    collection: 'system',
    details: `Connected to MongoDB database [${mongoose.connection.name || 'school_portal'}]`,
    status: 'success',
    durationMs: 1,
  });
});

mongoose.connection.on('error', (err) => {
  console.error('[DB] Mongoose connection error:', err.message);
  connectionError = err.message;
  dbMonitor.log({
    operation: 'CONNECT',
    collection: 'system',
    details: `MongoDB connection error: ${err.message}`,
    status: 'failed',
    durationMs: 1,
  });
});

mongoose.connection.on('disconnected', () => {
  console.log('[DB] Mongoose disconnected from MongoDB.');
  dbMonitor.log({
    operation: 'DISCONNECT',
    collection: 'system',
    details: 'Mongoose disconnected from MongoDB server',
    status: 'success',
    durationMs: 1,
  });
});

/**
 * Connect to MongoDB using provided or configured URI
 */
export async function connectDB(uriToConnect?: string): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  const targetUri = (uriToConnect || activeUri || process.env.MONGODB_URI || '').trim();

  if (!targetUri) {
    console.log('[DB] No MONGODB_URI provided. Active in embedded store mode with pre-seeded demo accounts.');
    return {
      success: false,
      message: 'No MongoDB URI provided. Running in embedded store mode.',
    };
  }
  mongoWasConfigured = true;

  const start = Date.now();

  try {
    // If already connected with the same URI, ping and return
    if (mongoose.connection.readyState === 1 && activeUri === targetUri) {
      const pingStart = Date.now();
      if (mongoose.connection.db) {
        await mongoose.connection.db.admin().ping();
      }
      await mongoSync.ensureAttendanceIndexes();
      lastPingMs = Date.now() - pingStart;
      return {
        success: true,
        message: 'Already connected to MongoDB.',
        details: await getDbConnectionStatus(),
      };
    }

    // Disconnect existing if changing connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    console.log(`[DB] Connecting to MongoDB: ${maskMongoUri(targetUri)}...`);

    await mongoose.connect(targetUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 10000,
    });

    activeUri = targetUri;
    await mongoSync.ensureAttendanceIndexes();
    const durationMs = Date.now() - start;

    // Ping check
    if (mongoose.connection.db) {
      const pingStart = Date.now();
      await mongoose.connection.db.admin().ping();
      lastPingMs = Date.now() - pingStart;
    }

    console.log(`[DB] Connected successfully to MongoDB in ${durationMs}ms.`);

    // Seed an empty database once; after that, MongoDB is the source of truth.
    try {
      const isSeeded = await mongoSync.seedMongoIfEmpty();
      if (!isSeeded) {
        console.log('[MongoSync] Loading existing MongoDB records into the portal store...');
        await mongoSync.pullAllFromMongo();
      }
    } catch (syncErr: any) {
      console.warn('[MongoSync] Warning during initial MongoDB sync:', syncErr.message);
    }

    return {
      success: true,
      message: `Successfully connected to MongoDB (${lastPingMs || durationMs}ms latency).`,
      details: await getDbConnectionStatus(),
    };
  } catch (error: any) {
    const durationMs = Date.now() - start;
    let friendlyMessage = error.message;

    if (
      error.message?.includes('whitelist') ||
      error.message?.includes('SSL alert') ||
      error.message?.includes('tlsv1 alert') ||
      error.message?.includes('ETIMEDOUT')
    ) {
      friendlyMessage =
        "Could not connect to MongoDB Atlas. Add this application server's public IP address in Atlas Network Access, and verify that the database username and password are correct.";
    }

    connectionError = friendlyMessage;
    console.warn(`[DB] MongoDB connection failed: ${friendlyMessage}. Running in embedded store mode.`);

    dbMonitor.log({
      operation: 'CONNECT',
      collection: 'system',
      details: `Connection failed: ${friendlyMessage}`,
      status: 'failed',
      durationMs,
    });

    return {
      success: false,
      message: friendlyMessage,
      details: { error: friendlyMessage, raw: error.message },
    };
  }
}

/**
 * Disconnect from MongoDB
 */
export async function disconnectDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  activeUri = null;
  lastPingMs = null;
}

/**
 * Get comprehensive MongoDB connection and collection status
 */
export async function getDbConnectionStatus() {
  const isConnected = mongoose.connection.readyState === 1;
  const isConnecting = mongoose.connection.readyState === 2;

  let ping = lastPingMs;
  if (isConnected && mongoose.connection.db) {
    try {
      const pStart = Date.now();
      await mongoose.connection.db.admin().ping();
      ping = Date.now() - pStart;
      lastPingMs = ping;
    } catch {
      // ping error ignored
    }
  }

  // Get collection counts from store & mongoose
  const collectionsSummary = [
    { name: 'users', label: 'User Accounts', model: 'UserModel' },
    { name: 'students', label: 'Students', model: 'StudentModel' },
    { name: 'teachers', label: 'Faculty Members', model: 'TeacherModel' },
    { name: 'classes', label: 'Classes & Sections', model: 'ClassModel' },
    { name: 'subjects', label: 'Subjects', model: 'SubjectModel' },
    { name: 'attendance', label: 'Daily Attendance', model: 'AttendanceModel' },
    { name: 'exams', label: 'Examinations', model: 'ExamModel' },
    { name: 'results', label: 'Student Results & Marks', model: 'ResultModel' },
    { name: 'timetable', label: 'Timetable Slots', model: 'TimetableModel' },
    { name: 'feestructures', label: 'Fee Structures', model: 'FeeStructureModel' },
    { name: 'feepayments', label: 'Fee Payments', model: 'FeePaymentModel' },
    { name: 'notifications', label: 'Notifications', model: 'NotificationModel' },
  ];

  const collectionsWithCounts = await Promise.all(
    collectionsSummary.map(async (c) => {
      let count = 0;
      try {
        const { total } = await mongoSync.getCollectionDocuments(c.name, { limit: 1 });
        count = total;
      } catch {
        count = 0;
      }
      return {
        ...c,
        documentCount: count,
      };
    })
  );

  const totalDocuments = collectionsWithCounts.reduce((acc, c) => acc + c.documentCount, 0);

  return {
    isConnected,
    isConnecting,
    mode: isConnected ? 'mongodb-live' : 'embedded-store',
    readyState: mongoose.connection.readyState,
    statusText: isConnected
      ? 'Connected (MongoDB Live Database)'
      : isConnecting
      ? 'Connecting...'
      : 'Embedded In-Memory Store (Ready to Connect)',
    databaseName: mongoose.connection.name || 'school_portal',
    host: mongoose.connection.host || 'localhost (embedded)',
    port: mongoose.connection.port || 27017,
    maskedUri: activeUri ? maskMongoUri(activeUri) : null,
    latencyMs: ping,
    mongooseVersion: mongoose.version,
    totalDocuments,
    collectionsCount: collectionsWithCounts.length,
    collections: collectionsWithCounts,
    lastError: connectionError,
  };
}

export default connectDB;
