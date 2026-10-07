import path from 'node:path';
import express from 'express';
import cors from 'cors';
import healthRoutes from './api/routes/health.routes.js';
import taskRoutes from './api/routes/task.routes.js';
import queueRoutes from './api/routes/queue.routes.js';
import { notFound } from './api/middleware/notFound.js';
import { errorHandler } from './api/middleware/errorHandler.js';
import { env } from './config/env.js';
import { uploadRoot } from './storage/localStorage.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // The Vite frontend runs on a different origin (127.0.0.1:5175 /
  // localhost:5175) and sends the custom `x-user-id` header, which triggers
  // a CORS preflight. Without this middleware Express answers OPTIONS with
  // no ACAO headers, so browsers block every API call. Permissive in dev;
  // tighten `origin` for production.
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Section 1 completion route
  app.use('/api/health', healthRoutes);

  // Sections 3+4 — tasks (fake-auth scoped)
  app.use('/api/tasks', taskRoutes);

  // Section 10 — queue metrics (fake-auth scoped)
  app.use('/api/queues', queueRoutes);

  // Section 8 — serve stored originals + thumbnails for the frontend.
  app.use('/uploads', express.static(path.resolve(uploadRoot), { maxAge: '1d', dotfiles: 'deny' }));

  // 404 for unknown routes (must be after all valid routes)
  app.use(notFound);

  // Centralized error handling (must be last)
  app.use(errorHandler);

  return app;
}

const app = createApp();

export default app;
