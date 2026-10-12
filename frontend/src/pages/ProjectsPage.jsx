import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2, FolderKanban, Filter, X } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Avatar from '../components/ui/Avatar.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import ProjectFormModal from '../components/forms/ProjectFormModal.jsx';
import { Spinner, ErrorState, EmptyState } from '../components/ui/States.jsx';
import { Select } from '../components/ui/FormControls.jsx';
import { useApi, useDebouncedValue } from '../hooks/useApi.js';
import { projectsApi, clientsApi, paymentsApi, getApiError } from '../services/api.js';
import { useNotify } from '../context/NotificationContext.jsx';
import { formatCurrency, formatDate } from '../utils/format.js';
import { PROJECT_STATUSES } from '../utils/validation.js';

export default function ProjectsPage() {
  const notify = useNotify();

  // Server-side filters per contract: ?status=&client=&search= (single values only).
  const [status, setStatus] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [query, setQuery] = useState('');
  const search = useDebouncedValue(query.trim(), 400);

  const params = useMemo(() => {
    const p = {};
    if (status) p.status = status;
    if (clientFilter) p.client = clientFilter;
    if (search) p.search = search.slice(0, 200);
    return p;
  }, [status, clientFilter, search]);

  const { data: projects, loading, error, refetch } = useApi(() => projectsApi.list(params), [status, clientFilter, search]);
  const { data: clients } = useApi(() => clientsApi.list(), []);
  const { data: payments, refetch: refetchPayments } = useApi(() => paymentsApi.list(), []);

  const paidByProject = useMemo(() => {
    const map = {};
    for (const p of payments || []) {
      const pid = typeof p.project === 'object' ? p.project?._id : p.project;
      if (pid) map[pid] = (map[pid] || 0) + p.amount;
    }
    return map;
  }, [payments]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const hasFilters = Boolean(status || clientFilter || query);
  const clearFilters = () => { setStatus(''); setClientFilter(''); setQuery(''); };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await projectsApi.remove(deleting._id);
      notify.success('Project deleted.');
      setDeleting(null);
      refetch();
      refetchPayments();
    } catch (err) {
      const apiError = getApiError(err);
      notify.error(apiError.message); // 409 while payments still reference the project
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const onSaved = (saved) => {
    refetch();
    // Optimistically keep list consistent when editing under an active filter.
    if (saved && !projects?.some((p) => p._id === saved._id)) refetch();
  };

  return (
    <div className="space-y-6">
      {/* Filter toolbar */}
      <Card bodyClassName="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="hidden items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:flex">
            <Filter size={13} /> Filters
          </span>
          <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search project names…"
              maxLength={200}
              className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-8 pr-8 text-sm shadow-sm transition placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600" aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </div>
          <Select
            aria-label="Filter by status"
            className="w-40"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={PROJECT_STATUSES.map((s) => ({ value: s, label: `Status: ${s}` }))}
            placeholder="All statuses"
          />
          <Select
            aria-label="Filter by client"
            className="w-48 max-w-full"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            options={(clients || []).map((c) => ({ value: c._id, label: c.name }))}
            placeholder="All clients"
          />
          {hasFilters && (
            <Button variant="ghost" size="sm" icon={X} onClick={clearFilters}>Clear</Button>
          )}
          <div className="ml-auto">
            <Button icon={Plus} onClick={() => { setEditing(null); setFormOpen(true); }}>New project</Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Filters run server-side via <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px] text-slate-500">GET /api/projects</code> — combined status, client, and name search.
        </p>
      </Card>

      <Card title={`Projects (${(projects || []).length}${hasFilters ? ' matching filters' : ''})`} bodyClassName="p-0">
        {loading ? (
          <Spinner />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (projects || []).length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title={hasFilters ? 'No matching projects' : 'No projects yet'}
            description={hasFilters ? 'Adjust or clear the filters above.' : 'Create your first project to start tracking fees and payments.'}
            action={!hasFilters && <Button icon={Plus} onClick={() => { setEditing(null); setFormOpen(true); }}>New project</Button>}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="px-6 py-3 font-semibold">Project</th>
                    <th className="px-4 py-3 font-semibold">Client</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Fee</th>
                    <th className="px-4 py-3 text-right font-semibold">Paid</th>
                    <th className="px-4 py-3 text-right font-semibold">Remaining</th>
                    <th className="px-4 py-3 font-semibold">Timeline</th>
                    <th className="px-6 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(projects || []).map((project) => {
                    const paid = paidByProject[project._id] || 0;
                    const remaining = Math.max(project.fee - paid, 0);
                    const clientName = typeof project.client === 'object' ? project.client?.name : null;
                    return (
                      <tr key={project._id} className="group transition-colors hover:bg-slate-50/70">
                        <td className="max-w-[260px] px-6 py-4">
                          <p className="truncate font-semibold text-slate-800">{project.projectName}</p>
                          {project.description && <p className="truncate text-xs text-slate-400">{project.description}</p>}
                        </td>
                        <td className="px-4 py-4">
                          {clientName ? (
                            <span className="flex items-center gap-2 text-slate-600">
                              <Avatar name={clientName} size="xs" /> {clientName}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4"><StatusBadge status={project.status} /></td>
                        <td className="px-4 py-4 text-right tabular-nums font-medium text-slate-700">{formatCurrency(project.fee)}</td>
                        <td className="px-4 py-4 text-right tabular-nums text-emerald-600">{formatCurrency(paid)}</td>
                        <td className={`px-4 py-4 text-right tabular-nums ${remaining > 0 ? 'font-semibold text-amber-600' : 'text-slate-400'}`}>{formatCurrency(remaining)}</td>
                        <td className="px-4 py-4 text-xs text-slate-500">
                          {project.startDate || project.dueDate ? (
                            <span>{formatDate(project.startDate)} → {formatDate(project.dueDate)}</span>
                          ) : '—'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                            <button type="button" onClick={() => { setEditing(project); setFormOpen(true); }} className="rounded-lg p-2 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600" aria-label={`Edit ${project.projectName}`}>
                              <Pencil size={15} />
                            </button>
                            <button type="button" onClick={() => setDeleting(project)} className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${project.projectName}`}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile/tablet cards */}
            <ul className="grid gap-4 p-4 sm:grid-cols-2 lg:hidden">
              {(projects || []).map((project) => {
                const paid = paidByProject[project._id] || 0;
                const remaining = Math.max(project.fee - paid, 0);
                const clientName = typeof project.client === 'object' ? project.client?.name : null;
                return (
                  <li key={project._id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-800">{project.projectName}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{clientName || 'No client'}</p>
                      </div>
                      <StatusBadge status={project.status} />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div><p className="text-[11px] uppercase tracking-wide text-slate-400">Fee</p><p className="text-sm font-semibold tabular-nums text-slate-700">{formatCurrency(project.fee)}</p></div>
                      <div><p className="text-[11px] uppercase tracking-wide text-slate-400">Paid</p><p className="text-sm font-semibold tabular-nums text-emerald-600">{formatCurrency(paid)}</p></div>
                      <div><p className="text-[11px] uppercase tracking-wide text-slate-400">Due</p><p className={`text-sm font-semibold tabular-nums ${remaining > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{formatCurrency(remaining)}</p></div>
                    </div>
                    {(project.startDate || project.dueDate) && (
                      <p className="mt-2 text-xs text-slate-400">{formatDate(project.startDate)} → {formatDate(project.dueDate)}</p>
                    )}
                    <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-3">
                      <Button variant="secondary" size="sm" icon={Pencil} onClick={() => { setEditing(project); setFormOpen(true); }}>Edit</Button>
                      <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setDeleting(project)} className="text-red-500 hover:bg-red-50 hover:text-red-600">Delete</Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>

      <ProjectFormModal open={formOpen} onClose={() => setFormOpen(false)} project={editing} clients={clients || []} onSaved={onSaved} />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={deleteBusy}
        title="Delete project"
        message={`Permanently delete “${deleting?.projectName}”? Payments recorded against it must be deleted or reassigned first — the API returns a conflict otherwise.`}
        confirmLabel="Delete project"
      />
    </div>
  );
}
