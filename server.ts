import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';
import { createServerApp } from './server/app.js';
import { connectDB } from './server/config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function start() {
  await connectDB();

  const app = createServerApp();
  const PORT = Number(process.env.PORT) || 3000;

  // In production, serve Vite built assets from dist
  const distPath = path.resolve(__dirname, 'dist');
  app.use(express.static(distPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) {
        res.status(200).send('EduManage School Portal Server Running. Build the client using npm run build.');
      }
    });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[EduManage] Server running on http://0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error('[EduManage] Fatal startup error:', err);
});
