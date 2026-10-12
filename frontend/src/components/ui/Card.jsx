export default function Card({ title, subtitle, action, children, className = '', bodyClassName = '' }) {
  const hasHeader = title || action;
  return (
    <section className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.03] ${className}`}>
      {hasHeader && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            {title && <h2 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={bodyClassName || (hasHeader ? 'p-5 sm:p-6' : '')}>{children}</div>
    </section>
  );
}
