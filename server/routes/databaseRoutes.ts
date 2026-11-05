import { Router } from 'express';
import {
  getStatus,
  connect,
  disconnect,
  syncDatabase,
  seedDatabase,
  getCollections,
  getCollectionDocuments,
  getLogs,
  clearLogs,
  getMetrics,
  exportDatabase,
} from '../controllers/databaseController.js';

const router = Router();

// Connection and status
router.get('/status', getStatus);
router.post('/connect', connect);
router.post('/disconnect', disconnect);
router.post('/sync', syncDatabase);
router.post('/seed', seedDatabase);

// Collections & Data inspection (monitor in database)
router.get('/collections', getCollections);
router.get('/collections/:name', getCollectionDocuments);

// Monitoring and telemetry
router.get('/logs', getLogs);
router.post('/logs/clear', clearLogs);
router.get('/metrics', getMetrics);
router.get('/export', exportDatabase);

export default router;
