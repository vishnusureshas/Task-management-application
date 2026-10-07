import { useCallback, useEffect, useState } from 'react';
import { QUEUE_NAMES, getAllQueueMetrics } from '../api/queues.js';

const MAILHOG_URL = import.meta.env.VITE_MAILHOG_URL ?? 'http://localhost:8025';
const POLL_MS = 3000;

// Plan §9.3: three queue cards, polled every 3s while mounted.
export default function QueuesPage() {
  const [metrics, setMetrics] = useState({});
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setMetrics(await getAllQueueMetrics());
    } catch {
      // Per-queue errors are already captured in getAllQueueMetrics.
    } finally {
      setLoading(false);
      setUpdatedAt(new Date());
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Queue metrics</h2>
          <p className="text-sm text-slate-500">
            Polled every {POLL_MS / 1000}s while this page is open.
            {updatedAt ? ` Last update: ${updatedAt.toLocaleTimeString()}` : ''}
          </p>
        </div>
        <a
          href={MAILHOG_URL}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          Open MailHog →
        </a>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-slate-600">Loading metrics…</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {QUEUE_NAMES.map((name) => {
            const m = metrics[name] ?? {};
            return (
              <article key={name} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-mono text-sm font-bold text-slate-900">{name}</h3>
                {m.error ? (
                  <p className="mt-2 text-sm text-red-700">{m.error}</p>
                ) : (
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-slate-50 p-2">
                      <dt className="text-xs text-slate-500">Waiting</dt>
                      <dd className="text-lg font-bold text-slate-900">{m.waiting ?? 0}</dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      <dt className="text-xs text-slate-500">Active</dt>
                      <dd className="text-lg font-bold text-slate-900">{m.active ?? 0}</dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      <dt className="text-xs text-slate-500">Completed</dt>
                      <dd className="text-lg font-bold text-emerald-700">{m.completed ?? 0}</dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      <dt className="text-xs text-slate-500">Failed</dt>
                      <dd className="text-lg font-bold text-red-700">{m.failed ?? 0}</dd>
                    </div>
                  </dl>
                )}
              </article>
            );
          })}
        </div>
      )}

      <p className="text-sm text-slate-500">
        Tip for the demo: create a task with images, then watch <em>taskProcessor</em> and{' '}
        <em>imageUpload</em> move — flip a task to COMPLETED on its detail page to see{' '}
        <em>emailDispatch</em> move.
      </p>
    </div>
  );
}
