import app from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { pingRedis, closeRedis } from './config/redis.js';
import { closeQueues } from './queues/index.js';
import { initSocket, closeSocket } from './sockets/socket.js';
import { closeEventBus } from './sockets/eventBus.js';
import { db } from './config/database.js';

const server = app.listen(env.port, () => {
  logger.info(`API listening on port ${env.port}`, { environment: env.nodeEnv });
});

// Non-blocking Redis check: API stays up even if Redis is down;
// queue operations will fail fast with a clear error instead.
pingRedis()
  .then((pong) => logger.info(`Redis reachable (${pong})`, { host: env.redisHost, port: env.redisPort }))
  .catch((err) => logger.warn('Redis not reachable — queues will fail until Redis is up', { error: err?.message }));

// Section 9: attach Socket.IO; a Redis outage must not prevent API boot.
initSocket(server)
  .then(() => logger.info('Socket.IO attached'))
  .catch((err) => logger.warn('Socket.IO not attached — real-time events paused until Redis is up', { error: err?.message }));

// ---- Graceful shutdown (Sections 1+5+9) ----
// Documented order: HTTP → Socket.IO → Queues/Workers → PostgreSQL → Redis → Exit.
let isShuttingDown = false;

function closeHttpServer() {
  return new Promise((resolve) => {
    server.close((err) => {
      if (err) logger.error('Error while closing HTTP server', { stack: err.stack });
      else logger.info('HTTP server closed.');
      resolve();
    });
  });
}

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`Received ${signal}. Shutting down gracefully...`);

  // Hard fallback: force exit if connections hang.
  const fallback = setTimeout(() => {
    logger.warn('Graceful shutdown timed out. Forcing exit.');
    process.exit(1);
  }, 10000);
  fallback.unref();

  try {
    await closeHttpServer();
    await closeSocket();
    logger.info('Socket.IO closed.');
    await closeQueues();
    logger.info('BullMQ queues closed.');
    await db.destroy();
    logger.info('PostgreSQL pool closed.');
    await closeEventBus().catch(() => {});
    await closeRedis();
    logger.info('Redis connections closed. Exiting.');
    clearTimeout(fallback);
    process.exit(0);
  } catch (err) {
    logger.error('Error during graceful shutdown', { stack: err?.stack ?? String(err) });
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    stack: reason instanceof Error ? reason.stack : String(reason),
  });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { stack: err?.stack });
  gracefulShutdown('uncaughtException');
});

export default server;
