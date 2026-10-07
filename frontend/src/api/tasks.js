import { request } from './client.js';

// Plan §5: task endpoints. All payloads use the backend's camelCase shapes.
export const listTasks = () => request('/api/tasks');

export function createTask({ title, description, priority, processingType }) {
  return request('/api/tasks', {
    method: 'POST',
    body: { title, description, priority, processingType },
  });
}

export function createTaskWithImages({ title, description, priority, processingType, files }) {
  const form = new FormData();
  form.append('title', title);
  if (description) form.append('description', description);
  if (priority) form.append('priority', priority);
  if (processingType) form.append('processingType', processingType);
  for (const file of files ?? []) {
    form.append('images', file);
  }
  return request('/api/tasks', { method: 'POST', form });
}

export function updateTaskStatus(id, status) {
  return request(`/api/tasks/${id}/status`, { method: 'PATCH', body: { status } });
}
