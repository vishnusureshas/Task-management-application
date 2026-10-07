import { Queue } from 'bullmq';
import { redisOptions } from '../config/redis.js';

export const TASK_PROCESSOR_QUEUE_NAME = 'taskProcessor';

// Queue = stores/schedules jobs only (Section 5).
// The Worker that consumes these jobs arrives in Section 6.
export const taskProcessorQueue = new Queue(TASK_PROCESSOR_QUEUE_NAME, {
  connection: { ...redisOptions },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

export function addTaskProcessorJob(data) {
  return taskProcessorQueue.add('process-task', data);
}

export default taskProcessorQueue;
