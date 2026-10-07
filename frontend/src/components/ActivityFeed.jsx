// Plan §9.2 activity feed: socket-driven email history (Option A, §12).
// Backend exposes email history only via socket events — no GET endpoint —
// so this feed is live-only and notes that in the empty state.
const TONE = {
  attempt: 'border-amber-200 bg-amber-50 text-amber-900',
  sent: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  failed: 'border-red-200 bg-red-50 text-red-900',
};

function describe(entry) {
  if (entry.kind === 'attempt') {
    return `Attempt ${entry.attempt ?? '?'} → ${entry.recipient ?? 'recipient'}`;
  }
  if (entry.kind === 'sent') {
    return `Sent to ${entry.recipient ?? 'recipient'} — ${entry.subject ?? 'no subject'}`;
  }
  return `Failed${entry.error ? `: ${entry.error}` : ''}`;
}

export default function ActivityFeed({ entries = [] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No email activity yet. History is live-only — keep this page open while status changes trigger emails
        (plan §12, Option A).
      </p>
    );
  }
  return (
    <ul className="grid gap-2">
      {entries.map((entry) => (
        <li
          key={`${entry.emailJobId ?? entry.kind}-${entry.at}-${entry.recipient ?? ''}`}
          className={`rounded-lg border px-3 py-2 text-sm ${TONE[entry.kind] ?? 'border-slate-200 bg-slate-50'}`}
        >
          <span className="font-semibold uppercase tracking-wide text-xs">{entry.kind}</span>
          <span className="block">{describe(entry)}</span>
          <span className="block text-xs opacity-70">{new Date(entry.at).toLocaleTimeString()}</span>
        </li>
      ))}
    </ul>
  );
}

// Turns the 3 email socket events into feed entries.
export function toActivityEntry(event, data) {
  const at = new Date().toISOString();
  if (event === 'email:attempt') {
    return { kind: 'attempt', at, ...data };
  }
  if (event === 'email:sent') {
    return { kind: 'sent', at, ...data };
  }
  if (event === 'email:failed') {
    return { kind: 'failed', at, ...data };
  }
  return null;
}
