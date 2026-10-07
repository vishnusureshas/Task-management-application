import { AppError } from '../utils/errors.js';
import { taskProcessorQueue, TASK_PROCESSOR_QUEUE_NAME } from './taskProcessor.queue.js';
import { imageUploadQueue, IMAGE_UPLOAD_QUEUE_NAME } from './imageUpload.queue.js';
import { emailDispatchQueue, EMAIL_DISPATCH_QUEUE_NAME } from './emailDispatch.queue.js';

export const QUEUE_NAMES = [TASK_PROCESSOR_QUEUE_NAME, IMAGE_UPLOAD_QUEUE_NAME, EMAIL_DISPATCH_QUEUE_NAME];

export const queues = {
  [TASK_PROCESSOR_QUEUE_NAME]: taskProcessorQueue,
  [IMAGE_UPLOAD_QUEUE_NAME]: imageUploadQueue,
  [EMAIL_DISPATCH_QUEUE_NAME]: emailDispatchQueue,
};

// Shared registry. Throws 400 for unknown names — reused by the
// Section 10 queue-metrics endpoint (`GET /api/queues/:name/metrics`).
export function getQueue(name) {
  const queue = queues[name];
  if (!queue) {
    throw new AppError(`Unknown queue: ${name}. Allowed: ${QUEUE_NAMES.join(', ')}`, 400);
  }
  return queue;
}

export async function closeQueues() {
  await Promise.all(Object.values(queues).map((q) => q.close().catch(() => {})));
}
