import { db } from '../src/config/database.js';
import { queues, closeQueues } from '../src/queues/index.js';
import { closeRedis } from '../src/config/redis.js';
import { closeEventBus } from '../src/sockets/eventBus.js';

// FK-safe table reset between tests (never touches migration tables).
export async function resetDb() {
  await db('email_jobs').del();
  await db('task_documents').del();
  await db('tasks').del();
}

// Full queue wipe (waiting + retained history) for test isolation.
export async function cleanQueues() {
  for (const queue of Object.values(queues)) {
    await queue.obliterate({ force: true }).catch(() => {});
  }
}

export async function closeAll() {
  await closeQueues();
  await closeEventBus();
  await closeRedis();
  await db.destroy();
}
