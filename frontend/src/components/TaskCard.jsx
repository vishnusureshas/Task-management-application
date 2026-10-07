import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge.jsx';
import DocumentThumb from './DocumentThumb.jsx';

export default function TaskCard({ task }) {
  const docs = task.documents ?? [];
  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 transition hover:border-slate-300 hover:shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <Link to={`/tasks/${task.id}`} className="font-semibold text-blue-700 hover:underline">
          {task.title}
        </Link>
        <StatusBadge status={task.status} />
      </div>
      {task.description ? <p className="mt-1.5 line-clamp-2 text-sm text-slate-600">{task.description}</p> : null}
      {docs.length > 0 ? (
        <div className="mt-2 flex items-center gap-1.5">
          {docs.slice(0, 4).map((doc) => (
            <DocumentThumb key={doc.id} document={doc} size="sm" />
          ))}
          {docs.length > 4 ? <span className="text-xs text-slate-500">+{docs.length - 4}</span> : null}
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>
          Priority: <strong className="text-slate-700">{task.priority}</strong>
        </span>
        <span>
          {docs.length} file{docs.length === 1 ? '' : 's'}
        </span>
        {task.createdAt ? (
          <span title={task.createdAt}>
            Created {new Date(task.createdAt).toLocaleString()}
          </span>
        ) : null}
        <Link to={`/tasks/${task.id}`} className="ml-auto font-medium text-blue-700 hover:underline">
          Open →
        </Link>
      </div>
    </article>
  );
}
