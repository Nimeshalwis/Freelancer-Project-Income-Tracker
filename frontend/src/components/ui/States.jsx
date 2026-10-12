import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import Button from './Button.jsx';

export function Spinner({ label = 'Loading…', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-16 text-slate-400 ${className}`}>
      <span className="relative flex h-10 w-10 items-center justify-center">
        <span className="absolute h-10 w-10 animate-ping rounded-full bg-indigo-100" />
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
      </span>
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

export function SkeletonRows({ rows = 5, className = '' }) {
  return (
    <div className={`space-y-3 p-5 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-slate-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded bg-slate-100" />
            <div className="h-3 w-1/2 rounded bg-slate-100" />
          </div>
          <div className="h-6 w-16 rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon size={22} />
      </span>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description && <p className="max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title="Something went wrong"
      description={error?.message || 'The request could not be completed.'}
      action={onRetry && <Button variant="secondary" icon={RefreshCw} onClick={onRetry}>Try again</Button>}
    />
  );
}
