import { useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2, Wallet, X } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Avatar from '../components/ui/Avatar.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import PaymentFormModal from '../components/forms/PaymentFormModal.jsx';
import { Spinner, ErrorState, EmptyState } from '../components/ui/States.jsx';
import { Select } from '../components/ui/FormControls.jsx';
import { useApi, useDebouncedValue } from '../hooks/useApi.js';
import { paymentsApi, projectsApi, getApiError } from '../services/api.js';
import { useNotify } from '../context/NotificationContext.jsx';
import { formatCurrency, formatDate } from '../utils/format.js';

// Payments have no server-side query filters in the contract (GET /api/payments takes none),
// so filtering below is intentionally client-side over the full list.
export default function PaymentsPage() {
  const notify = useNotify();
  const { data: payments, loading, error, refetch } = useApi(() => paymentsApi.list(), []);
  const { data: projects } = useApi(() => projectsApi.list(), []);

  const [query, setQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const search = useDebouncedValue(query.trim().toLowerCase(), 300);

  const rows = useMemo(() => {
    const list = (payments || []).map((payment) => ({
      ...payment,
      projectName: typeof payment.project === 'object' ? payment.project?.projectName : 'Unknown project',
      clientName: typeof payment.project === 'object' ? payment.project?.client?.name : null,
      status: typeof payment.project === 'object' ? payment.project?.status : null,
      projectId: typeof payment.project === 'object' ? payment.project?._id : payment.project,
    }));
    return list.filter((row) => {
      if (projectFilter && row.projectId !== projectFilter) return false;
      if (!search) return true;
      return [row.projectName, row.clientName, row.paymentMethod, row.notes].some((f) => (f || '').toLowerCase().includes(search));
    });
  }, [payments, search, projectFilter]);

  const totals = useMemo(() => {
    const sum = rows.reduce((acc, row) => acc + row.amount, 0);
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthSum = rows.filter((r) => (r.paymentDate || '').slice(0, 7) === thisMonth).reduce((acc, r) => acc + r.amount, 0);
    return { filteredTotal: sum, thisMonthTotal: monthSum };
  }, [rows]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const hasFilters = Boolean(query || projectFilter);

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await paymentsApi.remove(deleting._id);
      notify.success('Payment deleted — project balance released.');
      setDeleting(null);
      refetch();
    } catch (err) {
      notify.error(getApiError(err).message);
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Payments shown</p>
          <p className="mt-1 text-xl font-bold tabular-nums tracking-tight text-slate-900">{formatCurrency(totals.filteredTotal)}</p>
          <p className="text-[11px] text-slate-400">{rows.length} record{rows.length === 1 ? '' : 's'}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Received this calendar month</p>
          <p className="mt-1 text-xl font-bold tabular-nums tracking-tight text-emerald-600">{formatCurrency(totals.thisMonthTotal)}</p>
          <p className="text-[11px] text-slate-400">within current filter</p>
        </div>
        <div className="flex items-center justify-end rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/50 p-4">
          <Button icon={Plus} onClick={() => { setEditing(null); setFormOpen(true); }}>Record payment</Button>
        </div>
      </div>

      <Card bodyClassName="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search project, method, notes…"
              className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-8 pr-8 text-sm shadow-sm transition placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600" aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </div>
          <Select
            aria-label="Filter by project"
            className="w-56 max-w-full"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            options={(projects || []).map((p) => ({ value: p._id, label: p.projectName }))}
            placeholder="All projects"
          />
          {hasFilters && <Button variant="ghost" size="sm" icon={X} onClick={() => { setQuery(''); setProjectFilter(''); }}>Clear</Button>}
        </div>
      </Card>

      <Card title={`Payment history (${rows.length})`} bodyClassName="p-0">
        {loading ? (
          <Spinner />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title={hasFilters ? 'No matching payments' : 'No payments yet'}
            description={hasFilters ? 'Try adjusting your search or project filter.' : 'Record money received against a project to build your income history.'}
            action={!hasFilters && <Button icon={Plus} onClick={() => { setEditing(null); setFormOpen(true); }}>Record payment</Button>}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="px-6 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Project</th>
                    <th className="px-4 py-3 font-semibold">Client</th>
                    <th className="px-4 py-3 font-semibold">Method</th>
                    <th className="px-4 py-3 text-right font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Notes</th>
                    <th className="px-6 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((row) => (
                    <tr key={row._id} className="group transition-colors hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-6 py-4 text-xs text-slate-500">{formatDate(row.paymentDate)}</td>
                      <td className="max-w-[220px] px-4 py-4">
                        <p className="truncate font-medium text-slate-800">{row.projectName}</p>
                      </td>
                      <td className="px-4 py-4">
                        {row.clientName ? (
                          <span className="flex items-center gap-2 text-slate-600"><Avatar name={row.clientName} size="xs" /> {row.clientName}</span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{row.paymentMethod}</span>
                      </td>
                      <td className="px-4 py-4 text-right font-semibold tabular-nums text-emerald-600">{formatCurrency(row.amount)}</td>
                      <td className="max-w-[180px] px-4 py-4 text-xs text-slate-400">
                        <span className="block truncate" title={row.notes || ''}>{row.notes || '—'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                          <button type="button" onClick={() => { setEditing(row); setFormOpen(true); }} className="rounded-lg p-2 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600" aria-label="Edit payment">
                            <Pencil size={15} />
                          </button>
                          <button type="button" onClick={() => setDeleting(row)} className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600" aria-label="Delete payment">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-slate-100 lg:hidden">
              {rows.map((row) => (
                <li key={row._id} className="flex items-start gap-3 px-5 py-4">
                  <Avatar name={row.clientName || row.projectName} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate font-semibold text-slate-800">{row.projectName}</p>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-emerald-600">{formatCurrency(row.amount)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{row.clientName || '—'} · {row.paymentMethod}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{formatDate(row.paymentDate)}{row.status ? ` · ${row.status}` : ''}</p>
                    {row.notes && <p className="mt-1 truncate text-xs italic text-slate-400">“{row.notes}”</p>}
                    <div className="mt-2 flex gap-2">
                      <Button variant="secondary" size="sm" icon={Pencil} onClick={() => { setEditing(row); setFormOpen(true); }}>Edit</Button>
                      <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setDeleting(row)} className="text-red-500 hover:bg-red-50 hover:text-red-600">Delete</Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <PaymentFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        payment={editing}
        projects={projects || []}
        onSaved={refetch}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={deleteBusy}
        title="Delete payment"
        message={`Delete this ${formatCurrency(deleting?.amount)} payment recorded on ${formatDate(deleting?.paymentDate)} for “${deleting?.projectName}”? The project's outstanding balance will increase accordingly.`}
        confirmLabel="Delete payment"
      />
    </div>
  );
}
