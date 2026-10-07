import { db } from '../../config/database.js';
import { AppError } from '../../utils/errors.js';
import { addEmailDispatchJob } from '../../queues/emailDispatch.queue.js';

export const EMAIL_EVENTS = ['task.created', 'task.status_changed', 'task.completed'];

// email_jobs status vocabulary: PENDING → PROCESSING → SENT / FAILED.
export const EMAIL_STATUSES = ['PENDING', 'PROCESSING', 'SENT', 'FAILED'];

export function defaultRecipient(task) {
  return `user-${task.user_id}@example.com`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

// Section 14 — one template per event, plain text + simple HTML.
export function buildEmailTemplate({ event, task, fromStatus, toStatus, fallbackTitle }) {
  const title = task?.title ?? fallbackTitle ?? `Task #${task?.id ?? 'unknown'}`;
  const status = task?.status ?? toStatus ?? 'unknown';
  const safeTitle = escapeHtml(title);

  switch (event) {
    case 'task.created': {
      const subject = `Task created: ${title}`;
      const text = `Task "${title}" was created.\nStatus: ${status}\nPriority: ${task?.priority ?? 'unknown'}`;
      const html = `<p>Task &quot;${safeTitle}&quot; was created.</p><p>Status: ${escapeHtml(status)}</p>`;
      return { subject, text, html };
    }
    case 'task.status_changed': {
      const subject = `Task status changed: ${title}`;
      const text = `Task "${title}" changed from ${fromStatus ?? 'unknown'} to ${toStatus ?? status}.`;
      const html = `<p>Task &quot;${safeTitle}&quot; changed from ${escapeHtml(fromStatus ?? 'unknown')} to ${escapeHtml(toStatus ?? status)}.</p>`;
      return { subject, text, html };
    }
    case 'task.completed': {
      const subject = `Task completed: ${title}`;
      const text = `Task "${title}" has completed successfully.`;
      const html = `<p>Task &quot;${safeTitle}&quot; has completed successfully.</p>`;
      return { subject, text, html };
    }
    default: {
      const subject = `Task notification: ${title}`;
      const text = `Event ${event ?? 'notification'} for task "${title}".`;
      const html = `<p>Event ${escapeHtml(event ?? 'notification')} for task &quot;${safeTitle}&quot;.</p>`;
      return { subject, text, html };
    }
  }
}

// Producer: persist a PENDING email_jobs row, then enqueue the job.
// Called on task creation + every status change (Section 7 triggers).
export async function requestEmailNotification({ taskId, event, to, fromStatus, toStatus }) {
  const task = await db('tasks').where({ id: taskId }).first();

  if (!task) {
    throw new AppError(`Task ${taskId} not found`, 404);
  }

  const { subject } = buildEmailTemplate({ event, task, fromStatus, toStatus });
  const recipient = to ?? defaultRecipient(task);

  const [row] = await db('email_jobs')
    .insert({
      task_id: taskId,
      recipient,
      subject,
      status: 'PENDING',
      attempts: 0,
    })
    .returning('*');

  await addEmailDispatchJob({
    emailJobId: row.id,
    taskId,
    event,
    fromStatus: fromStatus ?? null,
    toStatus: toStatus ?? null,
  });

  return row;
}
