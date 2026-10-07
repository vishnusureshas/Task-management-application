import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

// Shared Redis options for BullMQ.
// BullMQ requires `maxRetriesPerRequest: null`.
export const redisOptions = {
  host: env.redisHost,
  port: env.redisPort,
  maxRetriesPerRequest: null,
};

// Plain client used for health checks / graceful shutdown.
// Each BullMQ Queue gets its own connection from `redisOptions`
// so queue traffic never blocks this client.
export const redis = new Redis({
  ...redisOptions,
  lazyConnect: true,
});

redis.on('connect', () => logger.info('Redis connecting', { host: env.redisHost, port: env.redisPort }));
redis.on('ready', () => logger.info('Redis ready'));
redis.on('error', (err) => logger.error('Redis error', { stack: err?.stack ?? String(err) }));

export async function pingRedis() {
  if (redis.status !== 'ready' && redis.status !== 'connect') {
    await redis.connect().catch(() => {});
  }
  return redis.ping();
}

export async function closeRedis() {
  if (redis.status === 'end') return;
  redis.removeAllListeners();
  await redis.quit().catch(() => redis.disconnect());
}

export default redis;
