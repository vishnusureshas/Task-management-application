import { pathToFileURL } from 'node:url';
import { Worker } from 'bullmq';
import { redisOptions } from '../config/redis.js';
import { env } from '../config/env.js';
import { db } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
import { TASK_PROCESSOR_QUEUE_NAME } from '../queues/taskProcessor.queue.js';
import { requestEmailNotification } from '../api/services/email.service.js';
import { publishTaskEvent, roomForTask, closeEventBus } from '../sockets/eventBus.js';
import { attachWorkerEvents } from './workerEvents.js';

// Fake slow work: random 5–10s per the plan. Overridable via
// TASK_WORKER_DELAY_MS for tests (Section 14).
const MIN_DELAY_MS = 5000;
const MAX_DELAY_MS = 10000;

export function resolveDelayMs() {
  if (env.taskWorkerDelayMs !== null) return env.taskWorkerDelayMs;
  return MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function markTaskStatus(taskId, status) {
  await db('tasks').where({ id: taskId }).update({ status, updated_at: db.fn.now() });
}

// Section 6 — Task Processor.
// Pure worker logic: no Express req/res here.
export async function processTaskJob(job) {
  const taskId = job?.data?.taskId;

  if (taskId === undefined || taskId === null || taskId === '') {
    throw new AppError('taskProcessor job missing taskId', 400);
  }

  const task = await db('tasks').where({ id: taskId }).first();

  if (!task) {
    logger.warn(`taskProcessor: task ${taskId} not found (job ${job?.id}) — failing job`);
    throw new AppError(`Task ${taskId} not found`, 404);
  }

  // Idempotency: a retry after a successful completion must not re-run work
  // (also prevents a duplicate completion email).
  if (task.status === 'COMPLETED') {
    logger.info(`taskProcessor: task ${taskId} already COMPLETED, skipping (job ${job?.id})`);
    return { taskId, skipped: true, status: 'COMPLETED' };
  }

  try {
    // FAILED is re-processable so BullMQ retries get a fresh attempt.
    await markTaskStatus(taskId, 'PROCESSING');
    logger.info(`taskProcessor: task ${taskId} PROCESSING (job ${job?.id})`);
    // Section 9: DB updated → real-time event to room `task:{id}`.
    await publishTaskEvent({ room: roomForTask(taskId), event: 'task:processing', data: { taskId, status: 'PROCESSING' } });

    await sleep(resolveDelayMs());

    await markTaskStatus(taskId, 'COMPLETED');
    logger.info(`taskProcessor: task ${taskId} COMPLETED (job ${job?.id})`);
    await publishTaskEvent({ room: roomForTask(taskId), event: 'task:completed', data: { taskId, status: 'COMPLETED' } });
  } catch (err) {
    // Failure flow: log + Task = FAILED (unless it completed meanwhile),
    // then rethrow so BullMQ counts the job as failed / retries.
    await db('tasks')
      .where({ id: taskId })
      .whereNot('status', 'COMPLETED')
      .update({ status: 'FAILED', updated_at: db.fn.now() })
      .catch((dbErr) => logger.error(`taskProcessor: could not mark task ${taskId} FAILED`, { error: dbErr?.message }));
    logger.error(`taskProcessor: task ${taskId} FAILED (job ${job?.id})`, { stack: err?.stack ?? String(err) });
    await publishTaskEvent({
      room: roomForTask(taskId),
      event: 'task:failed',
      data: { taskId, status: 'FAILED', error: err?.message ?? 'Task processing failed' },
    });
    throw err;
  }

  // Section 7: completion email via the tracked producer (creates the
  // email_jobs row; the email worker sends it). Never fail the task for this.
  try {
    await requestEmailNotification({ taskId, event: 'task.completed' });
  } catch (err) {
    logger.warn(`taskProcessor: email trigger failed for task ${taskId}`, { error: err?.message });
  }

  return { taskId, status: 'COMPLETED' };
}

export function startTaskProcessorWorker(overrides = {}) {
  const worker = new Worker(TASK_PROCESSOR_QUEUE_NAME, processTaskJob, {
    connection: { ...redisOptions },
    concurrency: overrides.concurrency ?? env.taskWorkerConcurrency,
  });

  return attachWorkerEvents(worker, TASK_PROCESSOR_QUEUE_NAME);
}

// Standalone entry: `npm run worker:task` (mirrors the Section 15
// docker-compose `task-worker` service; NOT started by the API process).
const isDirectRun = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isDirectRun) {
  const worker = startTaskProcessorWorker();
  logger.info('taskProcessor worker started', { concurrency: env.taskWorkerConcurrency });

  let closing = false;
  const shutdown = async (signal) => {
    if (closing) return;
    closing = true;
    logger.info(`taskProcessor worker received ${signal}, closing...`);
    await worker.close().catch(() => {});
    await closeEventBus().catch(() => {});
    await db.destroy().catch(() => {});
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
