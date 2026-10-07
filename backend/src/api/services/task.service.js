import { db } from '../../config/database.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { addTaskProcessorJob } from '../../queues/taskProcessor.queue.js';
import { addImageUploadJob } from '../../queues/imageUpload.queue.js';
import { requestEmailNotification } from './email.service.js';
import { publishTaskEvent, roomForTask } from '../../sockets/eventBus.js';
import { stageBuffer, uniqueName, extensionForMime } from '../../storage/localStorage.js';

function toTaskResponse(row) {
  if (!row) return row;
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    processingType: row.processing_type,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDocumentResponse(row) {
  if (!row) return row;
  return {
    id: row.id,
    status: row.status,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    size: row.size,
    originalUrl: row.original_url,
    thumbnailUrl: row.thumbnail_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createTask({ userId, title, description, priority, processingType, files = [] }) {
  const [row] = await db('tasks')
    .insert({
      user_id: userId,
      title,
      description,
      priority,
      processing_type: processingType,
      status: 'PENDING',
    })
    .returning('*');

  // Section 6: hand slow work to the queue, then return immediately.
  // Only the fast Redis ADD is awaited here — never the 5–10s worker.
  await addTaskProcessorJob({ taskId: row.id });

  // Section 7 trigger 1: task created. Notifications must never fail
  // task creation, so a trigger error is logged, not thrown.
  try {
    await requestEmailNotification({ taskId: row.id, event: 'task.created' });
  } catch (err) {
    logger.warn(`task.service: creation email trigger failed for task ${row.id}`, { error: err?.message });
  }

  // Section 8: stage each image, create its PENDING document row,
  // enqueue its imageUpload job. Per-file failures become FAILED rows
  // so one bad file never fails the whole task creation.
  const documents = [];
  for (const file of files) {
    try {
      const ext = extensionForMime(file.mimetype);
      if (!ext) throw new AppError(`Unsupported image type: ${file.mimetype}`, 400);
      const stagingPath = await stageBuffer(file.buffer, uniqueName(`t${row.id}`, ext));
      const [doc] = await db('task_documents')
        .insert({
          task_id: row.id,
          original_filename: file.originalname,
          mime_type: file.mimetype,
          size: file.size,
          status: 'PENDING',
        })
        .returning('*');
      await addImageUploadJob({
        documentId: doc.id,
        taskId: row.id,
        stagingPath,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
      });
      documents.push(toDocumentResponse(doc));
    } catch (err) {
      logger.warn(`task.service: image intake failed for task ${row.id} file ${file?.originalname}`, { error: err?.message });
      try {
        const [failed] = await db('task_documents')
          .insert({
            task_id: row.id,
            original_filename: file?.originalname ?? 'unknown',
            mime_type: file?.mimetype ?? null,
            size: file?.size ?? null,
            status: 'FAILED',
          })
          .returning('*');
        documents.push(toDocumentResponse(failed));
      } catch {}
    }
  }

  return { ...toTaskResponse(row), documents };
}

export async function listTasks(userId) {
  const rows = await db('tasks').where({ user_id: userId }).orderBy('created_at', 'desc');

  if (rows.length === 0) return [];

  const taskIds = rows.map((r) => r.id);
  const docRows = await db('task_documents')
    .whereIn('task_id', taskIds)
    .orderBy('created_at', 'asc');

  const docsByTask = new Map();
  for (const d of docRows) {
    if (!docsByTask.has(d.task_id)) docsByTask.set(d.task_id, []);
    docsByTask.get(d.task_id).push(toDocumentResponse(d));
  }

  return rows.map((row) => ({
    ...toTaskResponse(row),
    documents: docsByTask.get(row.id) ?? [],
  }));
}

export async function updateTaskStatus(userId, taskId, status) {
  const existing = await db('tasks').where({ id: taskId, user_id: userId }).first();

  if (!existing) {
    throw new AppError('Task not found', 404);
  }

  const [row] = await db('tasks').where({ id: taskId }).update({ status }, ['*']);

  // Section 7 trigger 2: task status changed (also the manual hook used
  // to test the email queue). Same resilience rule as creation.
  try {
    await requestEmailNotification({ taskId, event: 'task.status_changed', fromStatus: existing.status, toStatus: status });
  } catch (err) {
    logger.warn(`task.service: status-change email trigger failed for task ${taskId}`, { error: err?.message });
  }

  // Section 9: manual status changes bypass workers, so publish the
  // matching real-time event here (best-effort, never fails the request).
  const statusEvent = { PROCESSING: 'task:processing', COMPLETED: 'task:completed', FAILED: 'task:failed' }[status];
  if (statusEvent) {
    await publishTaskEvent({
      room: roomForTask(taskId),
      event: statusEvent,
      data: { taskId: Number(taskId), status, fromStatus: existing.status },
    });
  }

  return toTaskResponse(row);
}
