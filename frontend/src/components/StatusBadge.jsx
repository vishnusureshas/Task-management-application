const STYLES = {
  PENDING: 'bg-slate-200 text-slate-700',
  PROCESSING: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  FAILED: 'bg-red-100 text-red-800',
};

const LABELS = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
};

export default function StatusBadge({ status }) {
  const key = String(status ?? '').toUpperCase();
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${STYLES[key] ?? 'bg-slate-200 text-slate-700'}`}
    >
      {LABELS[key] ?? status}
    </span>
  );
}
