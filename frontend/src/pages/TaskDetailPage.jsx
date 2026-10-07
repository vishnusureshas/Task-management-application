import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { listTasks, updateTaskStatus } from '../api/tasks.js';
import { imageUrl } from '../api/client.js';
import useTaskSocket from '../sockets/useTaskSocket.js';
import { applyTaskEvent } from '../sockets/taskEvents.js';
import StatusBadge from '../components/StatusBadge.jsx';
import DocumentThumb from '../components/DocumentThumb.jsx';
import ActivityFeed, { toActivityEntry } from '../components/ActivityFeed.jsx';

const STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'];
const MAILHOG_URL = import.meta.env.VITE_MAILHOG_URL ?? 'http://localhost:8025';

// Plan §9.2: full task fields + documents grid + manual status buttons
// (doubles as the email-queue demo trigger) + socket-driven activity feed.
// Backend has no GET /:id, so the task is resolved from GET /api/tasks.
export default function TaskDetailPage() {
  const { id } = useParams();
  const taskId = Number(id);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [feed, setFeed] = useState([]);
  const [patchError, setPatchError] = useState('');
  const [patching, setPatching] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setTasks(await listTasks());
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSocketEvent = useCallback(
    (event, data) => {
      // Ignore events for other tasks (room should already scope this).
      if (data?.taskId !== undefined && Number(data.taskId) !== taskId) return;
      const entry = toActivityEntry(event, data);
      if (entry) setFeed((prev) => [entry, ...prev].slice(0, 50));
      setTasks((prev) => applyTaskEvent(prev, event, data));
    },
    [taskId],
  );

  const { connected } = useTaskSocket({
    taskIds: [taskId],
    onEvent: handleSocketEvent,
    onReconnect: refresh,
  });

  // Polling fallback while the socket is down (plan §6 rule 3).
  useEffect(() => {
    if (connected || loading) return undefined;
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [connected, loading, refresh]);

  async function onStatusChange(status) {
    setPatchError('');
    setPatching(status);
    try {
      const updated = await updateTaskStatus(taskId, status);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updated } : t)));
    } catch (err) {
      setPatchError(err.message);
    } finally {
      setPatching('');
    }
  }

  const task = tasks.find((t) => t.id === taskId);
  const docs = task?.documents ?? [];

  return (
    <div className="grid gap-6">
      <Link to="/" className="text-sm font-medium text-blue-700 hover:underline">
        ← Back to tasks
      </Link>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-slate-600">Loading…</p>
        </div>
      ) : null}

      {!loading && loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800 shadow-sm">
          <p>
            {loadError} <button onClick={refresh} className="ml-2 underline">Retry</button>
          </p>
        </div>
      ) : null}

      {!loading && !loadError && !task ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-slate-600">Task #{taskId} not found (it may belong to another user).</p>
        </div>
      ) : null}

      {task ? (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-slate-900">{task.title}</h2>
              <StatusBadge status={task.status} />
            </div>
            {task.description ? <p className="mt-2 text-slate-600">{task.description}</p> : null}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
              <span>Priority: <strong className="text-slate-700">{task.priority}</strong></span>
              <span>Type: <strong className="text-slate-700">{task.processingType ?? 'STANDARD'}</strong></span>
              <span className={`font-semibold ${connected ? 'text-emerald-700' : 'text-amber-700'}`}>
                {connected ? '● Live' : '● Offline — polling'}
              </span>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold text-slate-700">
                Manual status (also triggers the status-change email):
              </p>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={patching !== '' || task.status === s}
                    onClick={() => onStatusChange(s)}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-default disabled:opacity-40"
                  >
                    {patching === s ? 'Saving…' : s}
                  </button>
                ))}
              </div>
              {patchError ? <p className="mt-2 text-sm text-red-700">{patchError}</p> : null}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-3 text-base font-semibold text-slate-900">
              Documents ({docs.length})
            </h3>
            {docs.length === 0 ? (
              <p className="text-sm text-slate-500">No images attached to this task.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {docs.map((doc) => (
                  <div key={doc.id} className="grid gap-1">
                    <DocumentThumb document={doc} size="md" />
                    <span className="truncate text-xs text-slate-500" title={doc.originalFilename}>
                      {doc.originalFilename ?? `Document ${doc.id}`} · {doc.status}
                    </span>
                    {doc.thumbnailUrl ? (
                      <a
                        className="text-xs font-medium text-blue-700 hover:underline"
                        href={imageUrl(doc.originalUrl) ?? imageUrl(doc.thumbnailUrl)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open original
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Email activity</h3>
              <a
                href={MAILHOG_URL}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-blue-700 hover:underline"
              >
                Open MailHog →
              </a>
            </div>
            <ActivityFeed entries={feed} />
          </section>
        </>
      ) : null}
    </div>
  );
}
