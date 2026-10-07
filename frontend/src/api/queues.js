import { request } from './client.js';

// Plan §5.5: queue metrics for the dashboard page.
// Names: taskProcessor | imageUpload | emailDispatch. Anything else → 400.
export const QUEUE_NAMES = ['taskProcessor', 'imageUpload', 'emailDispatch'];

export function getQueueMetrics(name) {
  return request(`/api/queues/${name}/metrics`);
}

export async function getAllQueueMetrics() {
  const entries = await Promise.all(
    QUEUE_NAMES.map(async (name) => {
      try {
        const data = await getQueueMetrics(name);
        return [name, { ...data, error: '' }];
      } catch (err) {
        return [name, { queue: name, waiting: 0, active: 0, completed: 0, failed: 0, error: err.message }];
      }
    }),
  );
  return Object.fromEntries(entries);
}
