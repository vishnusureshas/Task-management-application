import { Queue } from 'bullmq';
import { redisOptions } from '../config/redis.js';

export const IMAGE_UPLOAD_QUEUE_NAME = 'imageUpload';

// Queue = stores/schedules jobs only (Section 5).
// The Worker that consumes these jobs arrives in Section 8.
export const imageUploadQueue = new Queue(IMAGE_UPLOAD_QUEUE_NAME, {
  connection: { ...redisOptions },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

export function addImageUploadJob(data) {
  return imageUploadQueue.add('process-image', data);
}

export default imageUploadQueue;
