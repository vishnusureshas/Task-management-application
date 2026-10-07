import { pathToFileURL } from 'node:url';
import { Worker } from 'bullmq';
import { redisOptions } from '../config/redis.js';
import { env } from '../config/env.js';
import { db } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
import { EMAIL_DISPATCH_QUEUE_NAME } from '../queues/emailDispatch.queue.js';
import { sendMail } from '../config/mailer.js';
import { buildEmailTemplate } from '../api/services/email.service.js';
import { publishTaskEvent, roomForTask, closeEventBus } from '../sockets/eventBus.js';
import { attachWorkerEvents } from './workerEvents.js';

// Section 7 — Email Dispatch worker.
// Retry policy (Section 13) lives on the queue: max 3 attempts,
// exponential backoff. This worker mirrors every attempt into the
// email_jobs row: attempts count, PROCESSING/SENT/FAILED status,
// error_message, sent_at.
// Pure worker logic: no Express req/res here.
export async function processEmailJob(job) {
  const { emailJobId, taskId, event, fromStatus, toStatus } = job?.data ?? {};

  if (!emailJobId) {
    throw new AppError('emailDispatch job missing emailJobId', 400);
  }

  const record = await db('email_jobs').where({ id: emailJobId }).first();

  if (!record) {
    logger.warn(`emailDispatch: email_job ${emailJobId} not found (job ${job?.id}) — failing job`);
    throw new AppError(`Email job ${emailJobId} not found`, 404);
  }

  // Idempotency: a retry after a successful send must not resend.
  if (record.status === 'SENT') {
    logger.info(`emailDispatch: email_job ${emailJobId} already SENT, skipping (job ${job?.id})`);
    return { emailJobId, skipped: true, status: 'SENT' };
  }

  const task = await db('tasks').where({ id: record.task_id ?? taskId }).first();

  const maxAttempts = job?.opts?.attempts ?? 3;
  const attemptNo = (record.attempts ?? 0) + 1;

  await db('email_jobs')
    .where({ id: emailJobId })
    .update({ attempts: attemptNo, status: 'PROCESSING', error_message: null, updated_at: db.fn.now() });

  logger.info(`emailDispatch: attempt ${attemptNo}/${maxAttempts} for email_job ${emailJobId} → ${record.recipient} (job ${job?.id})`);
  // Section 9: email_jobs updated → real-time event to room `task:{id}`.
  await publishTaskEvent({
    room: roomForTask(record.task_id ?? taskId),
    event: 'email:attempt',
    data: { emailJobId, taskId: record.task_id ?? taskId ?? null, recipient: record.recipient, attempt: attemptNo },
  });

  try {
    const { text, html } = buildEmailTemplate({
      event: event ?? 'task.notification',
      task,
      fromStatus,
      toStatus,
      fallbackTitle: record.subject,
    });

    await sendMail({ to: record.recipient, subject: record.subject, text, html });

    await db('email_jobs')
      .where({ id: emailJobId })
      .update({ status: 'SENT', sent_at: db.fn.now(), updated_at: db.fn.now() });

    logger.info(`emailDispatch: email_job ${emailJobId} SENT to ${record.recipient} (job ${job?.id})`);
    await publishTaskEvent({
      room: roomForTask(record.task_id ?? taskId),
      event: 'email:sent',
      data: { emailJobId, taskId: record.task_id ?? taskId ?? null, recipient: record.recipient, subject: record.subject },
    });

    return { emailJobId, status: 'SENT' };
  } catch (err) {
    const lastAttempt = attemptNo >= maxAttempts;
    const message = String(err?.message ?? err).slice(0, 1000);

    await db('email_jobs')
      .where({ id: emailJobId })
      .update({
        error_message: message,
        status: lastAttempt ? 'FAILED' : 'PROCESSING',
        updated_at: db.fn.now(),
      })
      .catch((dbErr) => logger.error(`emailDispatch: could not update email_job ${emailJobId}`, { error: dbErr?.message }));

    if (lastAttempt) {
      logger.error(`emailDispatch: email_job ${emailJobId} FAILED after ${attemptNo} attempts (job ${job?.id})`, { error: message });
      await publishTaskEvent({
        room: roomForTask(record.task_id ?? taskId),
        event: 'email:failed',
        data: { emailJobId, taskId: record.task_id ?? taskId ?? null, error: message },
      });
    } else {
      logger.warn(`emailDispatch: attempt ${attemptNo} failed for email_job ${emailJobId}, will retry (job ${job?.id})`, { error: message });
    }

    throw err;
  }
}

export function startEmailDispatchWorker(overrides = {}) {
  const worker = new Worker(EMAIL_DISPATCH_QUEUE_NAME, processEmailJob, {
    connection: { ...redisOptions },
    concurrency: overrides.concurrency ?? env.emailWorkerConcurrency,
  });

  return attachWorkerEvents(worker, EMAIL_DISPATCH_QUEUE_NAME);
}

// Standalone entry: `npm run worker:email` (mirrors the Section 15
// docker-compose `email-worker` service; NOT started by the API process).
const isDirectRun = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isDirectRun) {
  const worker = startEmailDispatchWorker();
  logger.info('emailDispatch worker started', { concurrency: env.emailWorkerConcurrency });

  let closing = false;
  const shutdown = async (signal) => {
    if (closing) return;
    closing = true;
    logger.info(`emailDispatch worker received ${signal}, closing...`);
    await worker.close().catch(() => {});
    await closeEventBus().catch(() => {});
    await db.destroy().catch(() => {});
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
