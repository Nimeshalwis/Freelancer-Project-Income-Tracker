import { PROJECT_STATUSES } from '../../utils/validation.js';

const STYLES = {
  Pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  'In Progress': 'bg-sky-50 text-sky-700 ring-sky-600/20',
  Completed: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
};

const DOTS = {
  Pending: 'bg-amber-500',
  'In Progress': 'bg-sky-500',
  Completed: 'bg-emerald-500',
};

export default function StatusBadge({ status }) {
  if (!status) return <span className="text-xs text-slate-400">—</span>;
  const known = PROJECT_STATUSES.includes(status);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STYLES[status] || 'bg-slate-50 text-slate-600 ring-slate-500/20'}`}>
      {known && <span className={`h-1.5 w-1.5 rounded-full ${DOTS[status]}`} />}
      {status}
    </span>
  );
}
