import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { Worker } from 'bullmq';
import { redisOptions } from '../config/redis.js';
import { env } from '../config/env.js';
import { db } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
import { IMAGE_UPLOAD_QUEUE_NAME } from '../queues/imageUpload.queue.js';
import { publishTaskEvent, roomForTask, closeEventBus } from '../sockets/eventBus.js';
import { attachWorkerEvents } from './workerEvents.js';
import {
  storeOriginal,
  storeThumbnail,
  removeStaged,
  uniqueName,
  originalUrlFor,
  thumbnailUrlFor,
} from '../storage/localStorage.js';

export const THUMBNAIL_SIZE = 256;

// Section 8 — Image Upload worker.
// Read image → Sharp 256px thumbnail → store original + thumbnail →
// task_documents = COMPLETED. Pure worker logic: no Express req/res here.
export async function processImageJob(job) {
  const { documentId, taskId, stagingPath } = job?.data ?? {};

  if (!documentId) {
    throw new AppError('imageUpload job missing documentId', 400);
  }

  const doc = await db('task_documents').where({ id: documentId }).first();

  if (!doc) {
    logger.warn(`imageUpload: document ${documentId} not found (job ${job?.id}) — failing job`);
    throw new AppError(`Document ${documentId} not found`, 404);
  }

  if (taskId && doc.task_id !== taskId) {
    throw new AppError(`Document ${documentId} does not belong to task ${taskId}`, 400);
  }

  // Idempotency: a retry after success must not reprocess.
  if (doc.status === 'COMPLETED') {
    logger.info(`imageUpload: document ${documentId} already COMPLETED, skipping (job ${job?.id})`);
    return { documentId, skipped: true, status: 'COMPLETED' };
  }

  try {
    await db('task_documents').where({ id: documentId }).update({ status: 'PROCESSING', updated_at: db.fn.now() });
    logger.info(`imageUpload: document ${documentId} PROCESSING (job ${job?.id})`);
    // Section 9: DB updated → real-time event to room `task:{id}`.
    await publishTaskEvent({
      room: roomForTask(doc.task_id),
      event: 'document:processing',
      data: { documentId, taskId: doc.task_id, status: 'PROCESSING' },
    });

    const input = await readFile(stagingPath);
    const pipeline = sharp(input);
    const metadata = await pipeline.metadata();

    if (!metadata.format) {
      throw new AppError(`Document ${documentId} is not a readable image`, 400);
    }

    const ext = metadata.format === 'jpeg' ? '.jpg' : `.${metadata.format}`;
    const base = uniqueName(`d${documentId}`, '');
    const originalName = `${base}${ext}`;
    const thumbName = `${base}-thumb${ext}`;

    await storeOriginal(originalName, input);

    const thumbnail = await pipeline
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'inside', withoutEnlargement: true })
      .toFormat(metadata.format)
      .toBuffer();
    await storeThumbnail(thumbName, thumbnail);

    const [updated] = await db('task_documents')
      .where({ id: documentId })
      .update(
        {
          status: 'COMPLETED',
          original_url: originalUrlFor(originalName),
          thumbnail_url: thumbnailUrlFor(thumbName),
          updated_at: db.fn.now(),
        },
        ['*'],
      );

    await removeStaged(stagingPath);

    logger.info(`imageUpload: document ${documentId} COMPLETED (job ${job?.id})`, {
      originalUrl: updated.original_url,
      thumbnailUrl: updated.thumbnail_url,
    });
    await publishTaskEvent({
      room: roomForTask(doc.task_id),
      event: 'document:completed',
      data: {
        documentId,
        taskId: doc.task_id,
        status: 'COMPLETED',
        originalUrl: updated.original_url,
        thumbnailUrl: updated.thumbnail_url,
      },
    });

    return { documentId, status: 'COMPLETED', originalUrl: updated.original_url, thumbnailUrl: updated.thumbnail_url };
  } catch (err) {
    await db('task_documents')
      .where({ id: documentId })
      .whereNot('status', 'COMPLETED')
      .update({ status: 'FAILED', updated_at: db.fn.now() })
      .catch((dbErr) => logger.error(`imageUpload: could not mark document ${documentId} FAILED`, { error: dbErr?.message }));
    logger.error(`imageUpload: document ${documentId} FAILED (job ${job?.id})`, { stack: err?.stack ?? String(err) });
    // `document:failed` is a small extension beyond the 8 recommended
    // plan events — symmetric with `task:failed` / `email:failed`.
    await publishTaskEvent({
      room: roomForTask(doc.task_id),
      event: 'document:failed',
      data: { documentId, taskId: doc.task_id, status: 'FAILED', error: err?.message ?? 'Image processing failed' },
    });
    throw err;
  }
}

export function startImageUploadWorker(overrides = {}) {
  const worker = new Worker(IMAGE_UPLOAD_QUEUE_NAME, processImageJob, {
    connection: { ...redisOptions },
    concurrency: overrides.concurrency ?? env.imageWorkerConcurrency,
  });

  return attachWorkerEvents(worker, IMAGE_UPLOAD_QUEUE_NAME);
}

// Standalone entry: `npm run worker:image` (mirrors the Section 15
// docker-compose `image-worker` service; NOT started by the API process).
const isDirectRun = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isDirectRun) {
  const worker = startImageUploadWorker();
  logger.info('imageUpload worker started', { concurrency: env.imageWorkerConcurrency });

  let closing = false;
  const shutdown = async (signal) => {
    if (closing) return;
    closing = true;
    logger.info(`imageUpload worker received ${signal}, closing...`);
    await worker.close().catch(() => {});
    await closeEventBus().catch(() => {});
    await db.destroy().catch(() => {});
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
