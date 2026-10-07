import { db } from '../src/config/database.js';
import { requestEmailNotification } from '../src/api/services/email.service.js';
import { processEmailJob } from '../src/workers/emailDispatch.worker.js';
import { env } from '../src/config/env.js';
import { resetDb, cleanQueues, closeAll } from './helpers.js';

beforeEach(async () => {
  await resetDb();
  await cleanQueues();
});

afterAll(async () => {
  await closeAll();
});

describe('emailDispatch worker (Section 7 flow)', () => {
  it('sends via MailHog and tracks SENT + attempts + sent_at', async () => {
    const title = `Test email ${Date.now()}`;
    const [task] = await db('tasks')
      .insert({ user_id: '123', title, priority: 'MEDIUM', processing_type: 'STANDARD', status: 'PENDING' })
      .returning('*');

    const row = await requestEmailNotification({ taskId: task.id, event: 'task.created' });
    expect(row.status).toBe('PENDING');
    expect(row.attempts).toBe(0);

    const result = await processEmailJob({
      id: 'email-test-1',
      data: { emailJobId: row.id, taskId: task.id, event: 'task.created' },
      opts: { attempts: 3 },
      attemptsMade: 0,
    });

    expect(result).toEqual({ emailJobId: row.id, status: 'SENT' });

    const updated = await db('email_jobs').where({ id: row.id }).first();
    expect(updated.status).toBe('SENT');
    expect(updated.attempts).toBe(1);
    expect(updated.sent_at).not.toBeNull();

    // MailHog really received it.
    const res = await fetch(`http://${env.smtpHost}:${env.mailhogUiPort}/api/v2/messages`);
    const body = await res.json();
    const subjects = (body.items ?? []).map((m) => m.Content?.Headers?.Subject?.[0]);
    expect(subjects).toContain(`Task created: ${title}`);
  });

  it('rejects jobs without an emailJobId', async () => {
    await expect(processEmailJob({ id: 'email-test-2', data: {}, opts: { attempts: 3 }, attemptsMade: 0 })).rejects.toThrow(
      'missing emailJobId',
    );
  });
});
