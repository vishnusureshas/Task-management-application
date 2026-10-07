import { getQueue } from '../../queues/index.js';

// Section 10 — Queue Metrics.
// Response data matches the plan shape:
// { queue, waiting, active, completed, failed }.
export async function getQueueMetrics(req, res) {
  const { name } = req.params;
  const queue = getQueue(name);

  const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed');

  res.status(200).json({
    success: true,
    data: {
      queue: name,
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
    },
  });
}
