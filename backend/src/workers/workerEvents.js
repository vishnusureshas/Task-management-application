import { logger } from '../utils/logger.js';

// Section 11 — Queue Event Listeners (non-functional requirement).
// Every worker listens for: completed, failed, stalled (+ worker error).
// One shared helper so coverage is identical across all queues:
//
//   Job
//    ├── completed → log
//    ├── failed    → log
//    └── stalled   → log
export const WORKER_LIFECYCLE_EVENTS = ['completed', 'failed', 'stalled'];

export function attachWorkerEvents(worker, queueName) {
  worker.on('completed', (job, result) => logger.info(`${queueName} completed (job ${job.id})`, { result }));
  worker.on('failed', (job, err) => logger.warn(`${queueName} failed (job ${job?.id})`, { error: err?.message }));
  worker.on('stalled', (jobId) => logger.warn(`${queueName} stalled (job ${jobId})`));
  worker.on('error', (err) => logger.error(`${queueName} worker error`, { stack: err?.stack ?? String(err) }));

  return worker;
}
