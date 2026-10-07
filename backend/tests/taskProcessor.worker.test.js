import { db } from '../src/config/database.js';
import { processTaskJob, startTaskProcessorWorker } from '../src/workers/taskProcessor.worker.js';
import { taskProcessorQueue } from '../src/queues/taskProcessor.queue.js';
import { resetDb, cleanQueues, closeAll } from './helpers.js';

let taskId;

beforeEach(async () => {
  await resetDb();
  await cleanQueues();
  [taskId] = await db('tasks')
    .insert({ user_id: '123', title: 'Worker test', priority: 'MEDIUM', processing_type: 'STANDARD', status: 'PENDING' })
    .returning('id')
    .then((rows) => rows.map((r) => (typeof r === 'object' ? r.id : r)));
});

afterAll(async () => {
  await closeAll();
});

describe('taskProcessor worker (Section 6 flow)', () => {
  it('moves PENDING → PROCESSING → COMPLETED without the API waiting', async () => {
    // TASK_WORKER_DELAY_MS=50 in tests/setupEnv.js keeps this fast.
    const result = await processTaskJob({ id: 'test-job-1', data: { taskId } });

    expect(result).toEqual({ taskId, status: 'COMPLETED' });
    const row = await db('tasks').where({ id: taskId }).first();
    expect(row.status).toBe('COMPLETED');
  });

  it('skips already-COMPLETED tasks (idempotent retries)', async () => {
    await processTaskJob({ id: 'test-job-1', data: { taskId } });
    const result = await processTaskJob({ id: 'test-job-2', data: { taskId } });
    expect(result).toEqual({ taskId, skipped: true, status: 'COMPLETED' });
  });

  it('fails the job for a missing task (Section 6 failure flow)', async () => {
    await expect(processTaskJob({ id: 'test-job-3', data: { taskId: 999999 } })).rejects.toThrow('Task 999999 not found');
  });

  it('fails queued jobs end-to-end through BullMQ', async () => {
    const worker = startTaskProcessorWorker();
    try {
      const job = await taskProcessorQueue.add('process-task', { taskId: 999999 }, { attempts: 1 });
      const started = Date.now();
      let state = '';
      while (Date.now() - started < 15000) {
        await new Promise((r) => setTimeout(r, 500));
        const current = await taskProcessorQueue.getJob(job.id);
        state = await current.getState();
        if (state === 'failed' || state === 'completed') break;
      }
      expect(state).toBe('failed');
      const finished = await taskProcessorQueue.getJob(job.id);
      await finished.remove();
    } finally {
      await worker.close();
    }
  }, 25000);
});
