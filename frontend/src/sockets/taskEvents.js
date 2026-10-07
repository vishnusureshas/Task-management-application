// Pure state-merge helpers for socket events (plan §7).
// Framework-free on purpose: unit-testable in Node, reused by every page.

export const TASK_EVENTS = [
  'task:processing',
  'task:completed',
  'task:failed',
  'document:processing',
  'document:completed',
  'document:failed',
  'email:attempt',
  'email:sent',
  'email:failed',
];

const TASK_STATUS_EVENTS = new Set(['task:processing', 'task:completed', 'task:failed']);
const DOCUMENT_EVENTS = new Set(['document:processing', 'document:completed', 'document:failed']);

export function mergeDocument(documents, data) {
  const existing = (documents ?? []).find((d) => d.id === data.documentId);
  const merged = {
    ...(existing ?? { id: data.documentId, taskId: data.taskId }),
    status: data.status ?? existing?.status,
    ...(data.originalUrl !== undefined ? { originalUrl: data.originalUrl } : {}),
    ...(data.thumbnailUrl !== undefined ? { thumbnailUrl: data.thumbnailUrl } : {}),
  };
  if (existing) {
    return documents.map((d) => (d.id === data.documentId ? merged : d));
  }
  return [...(documents ?? []), merged];
}

// Returns a NEW task array (never mutates). Unknown events pass through.
export function applyTaskEvent(tasks, event, data) {
  if (!data) return tasks;

  if (TASK_STATUS_EVENTS.has(event)) {
    return (tasks ?? []).map((t) =>
      t.id === data.taskId ? { ...t, status: data.status ?? t.status } : t,
    );
  }

  if (DOCUMENT_EVENTS.has(event)) {
    return (tasks ?? []).map((t) =>
      t.id === data.taskId ? { ...t, documents: mergeDocument(t.documents, data) } : t,
    );
  }

  return tasks;
}
