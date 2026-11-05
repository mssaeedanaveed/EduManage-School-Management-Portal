import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from '../config/db.js';
import store from '../data/store.js';

async function runSeed() {
  console.log('[Seed] Initializing seed script...');
  const isMongo = await connectDB();
  store.resetToSeed();
  console.log(`[Seed] Seed data successfully populated into ${isMongo ? 'MongoDB' : 'in-memory store'}.`);
  console.log('[Seed] Ready accounts:');
  console.log('  Admin:   admin@school.edu     / password123');
  console.log('  Teacher: teacher@school.edu   / password123');
  console.log('  Student: student@school.edu   / password123');
  console.log('  Parent:  parent@school.edu    / password123');
  process.exit(0);
}

runSeed().catch((err) => {
  console.error('[Seed] Error during seeding:', err);
  process.exit(1);
});
