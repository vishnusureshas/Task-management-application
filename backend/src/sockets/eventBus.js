import Redis from 'ioredis';
import { redisOptions } from '../config/redis.js';
import { logger } from '../utils/logger.js';

// Redis pub/sub bridge between worker processes and the API process.
// Workers can only PUBLISH here; only the API process SUBSCRIBES and
// forwards to Socket.IO rooms. Delivery is best-effort by design:
// a failed publish must never fail a job or an HTTP request.
export const TASK_EVENTS_CHANNEL = 'pern:task-events';

let publisher = null;
let subscriber = null;

export function roomForTask(taskId) {
  return `task:${taskId}`;
}

function getPublisher() {
  if (!publisher) {
    publisher = new Redis({ ...redisOptions, lazyConnect: true });
    publisher.on('error', (err) => logger.error('eventBus publisher error', { error: err?.message }));
  }
  return publisher;
}

export async function publishTaskEvent({ room, event, data }) {
  try {
    const pub = getPublisher();
    if (pub.status !== 'ready' && pub.status !== 'connect') {
      await pub.connect().catch(() => {});
    }
    await pub.publish(
      TASK_EVENTS_CHANNEL,
      JSON.stringify({ room, event, data: data ?? {}, at: new Date().toISOString() }),
    );
  } catch (err) {
    logger.warn('eventBus publish failed', { room, event, error: err?.message });
  }
}

// API process only: one dedicated subscriber connection (a client in
// subscriber mode cannot run other commands, hence separate from publisher).
export async function subscribeTaskEvents(onEvent) {
  if (!subscriber) {
    subscriber = new Redis({ ...redisOptions, lazyConnect: true });
    subscriber.on('error', (err) => logger.error('eventBus subscriber error', { error: err?.message }));
  }

  if (subscriber.status !== 'ready' && subscriber.status !== 'connect') {
    await subscriber.connect().catch(() => {});
  }
  await subscriber.subscribe(TASK_EVENTS_CHANNEL);

  subscriber.on('message', (channel, message) => {
    if (channel !== TASK_EVENTS_CHANNEL) return;
    try {
      onEvent(JSON.parse(message));
    } catch (err) {
      logger.warn('eventBus received invalid message', { error: err?.message });
    }
  });

  return subscriber;
}

export async function closeEventBus() {
  const pending = [];
  if (subscriber) {
    const s = subscriber;
    subscriber = null;
    s.removeAllListeners();
    pending.push(s.quit().catch(() => s.disconnect()));
  }
  if (publisher) {
    const p = publisher;
    publisher = null;
    p.removeAllListeners();
    pending.push(p.quit().catch(() => p.disconnect()));
  }
  await Promise.all(pending);
}
