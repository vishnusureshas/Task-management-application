import TaskCard from './TaskCard.jsx';

// Plan §8: list states (loading / error+retry / empty / cards) live here so
// TasksPage stays focused on data + socket wiring.
export default function TaskList({ tasks = [], loading, loadError, onRetry }) {
  if (loading) {
    return <p className="text-slate-600">Loading…</p>;
  }
  if (loadError) {
    return (
      <p className="text-sm text-red-700">
        {loadError}{' '}
        <button onClick={onRetry} className="ml-1 underline">
          Retry
        </button>
      </p>
    );
  }
  if (tasks.length === 0) {
    return <p className="text-slate-600">No tasks yet — create the first one above.</p>;
  }
  return (
    <div className="grid gap-3">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  );
}
