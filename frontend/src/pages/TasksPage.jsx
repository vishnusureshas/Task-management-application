import { useCallback, useEffect, useMemo, useState } from 'react';
import { listTasks } from '../api/tasks.js';
import TaskForm from '../components/TaskForm.jsx';
import TaskList from '../components/TaskList.jsx';
import useTaskSocket from '../sockets/useTaskSocket.js';
import { applyTaskEvent } from '../sockets/taskEvents.js';

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

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

  // Live merge: socket events update tasks in place, no reload (plan §6).
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);
  const handleSocketEvent = useCallback((event, data) => {
    setTasks((prev) => applyTaskEvent(prev, event, data));
  }, []);
  const { connected } = useTaskSocket({ taskIds, onEvent: handleSocketEvent, onReconnect: refresh });

  // Polling fallback while the socket is down (plan §6 rule 3).
  useEffect(() => {
    if (connected || loading) return undefined;
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [connected, loading, refresh]);

  return (
    <div className="grid gap-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-900">New task</h2>
        <TaskForm onCreated={(created) => setTasks((prev) => [created, ...prev])} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Tasks</h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              connected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {connected ? '● Live' : '● Offline — polling'}
          </span>
        </div>
        <TaskList tasks={tasks} loading={loading} loadError={loadError} onRetry={refresh} />
      </section>
    </div>
  );
}
