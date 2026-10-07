import { useEffect, useState } from 'react';
import { getHealth } from '../api/client.js';

// Plan §9.4: header dot from GET /api/health (green `up`, red otherwise).
// Polls every 15s so backend restarts are noticed without a reload.
export default function HealthBadge({ intervalMs = 15000 }) {
  const [state, setState] = useState('checking'); // checking | up | down

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const data = await getHealth();
        if (!cancelled) setState(data?.status === 'up' ? 'up' : 'down');
      } catch {
        if (!cancelled) setState('down');
      }
    }

    check();
    const timer = setInterval(check, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [intervalMs]);

  const dot = state === 'up' ? 'bg-emerald-500' : state === 'down' ? 'bg-red-500' : 'bg-slate-400';
  const label = state === 'up' ? 'API up' : state === 'down' ? 'API down' : 'API …';
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600"
      title={label}
      role="status"
    >
      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
