import { Queue } from 'bullmq';
import { redisOptions } from '../config/redis.js';

export const EMAIL_DISPATCH_QUEUE_NAME = 'emailDispatch';

// Queue = stores/schedules jobs only (Section 5).
// The Worker that consumes these jobs arrives in Section 7.
// Retry policy already matches Section 13: max 3 attempts,
// exponential backoff.
export const emailDispatchQueue = new Queue(EMAIL_DISPATCH_QUEUE_NAME, {
  connection: { ...redisOptions },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

export function addEmailDispatchJob(data, overrides = {}) {
  return emailDispatchQueue.add('dispatch-email', data, overrides);
}

export default emailDispatchQueue;
