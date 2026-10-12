import { useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2, Users, Mail, Phone, Building2 } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Avatar from '../components/ui/Avatar.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import ClientFormModal from '../components/forms/ClientFormModal.jsx';
import { Spinner, ErrorState, EmptyState } from '../components/ui/States.jsx';
import { useApi, useDebouncedValue } from '../hooks/useApi.js';
import { clientsApi, getApiError } from '../services/api.js';
import { useNotify } from '../context/NotificationContext.jsx';
import { formatDate } from '../utils/format.js';

export default function ClientsPage() {
  const notify = useNotify();
  const { data: clients, loading, error, refetch } = useApi(() => clientsApi.list(), []);
  const [query, setQuery] = useState('');
  const search = useDebouncedValue(query.trim().toLowerCase(), 300);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const filtered = useMemo(() => {
    const list = clients || [];
    if (!search) return list;
    return list.filter((c) =>
      [c.name, c.email, c.phone, c.company].some((field) => (field || '').toLowerCase().includes(search)),
    );
  }, [clients, search]);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (client) => { setEditing(client); setFormOpen(true); };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await clientsApi.remove(deleting._id);
      notify.success('Client deleted.');
      setDeleting(null);
      refetch();
    } catch (err) {
      const apiError = getApiError(err);
      notify.error(apiError.message); // 409 when the client still has projects
      if (apiError.status === 409) setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card
        title={`Clients (${(clients || []).length})`}
        subtitle="People and companies you work with. Everything is private to your account."
        action={
          <>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email, company…"
                className="h-9 w-44 rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-sm shadow-sm transition placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 sm:w-64"
              />
            </div>
            <Button icon={Plus} onClick={openCreate}>Add client</Button>
          </>
        }
        bodyClassName="p-0"
      >
        {loading ? (
          <Spinner />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search ? 'No matching clients' : 'No clients yet'}
            description={search ? 'Try a different search term.' : 'Add your first client to start attaching projects to them.'}
            action={!search && <Button icon={Plus} onClick={openCreate}>Add client</Button>}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="px-6 py-3 font-semibold">Client</th>
                    <th className="px-4 py-3 font-semibold">Contact</th>
                    <th className="px-4 py-3 font-semibold">Company</th>
                    <th className="px-4 py-3 font-semibold">Added</th>
                    <th className="px-6 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((client) => (
                    <tr key={client._id} className="group transition-colors hover:bg-slate-50/70">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={client.name} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-800">{client.name}</p>
                            {client.notes && <p className="max-w-[220px] truncate text-xs text-slate-400">{client.notes}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-0.5 text-xs text-slate-500">
                          {client.email && <p className="flex items-center gap-1.5"><Mail size={12} className="text-slate-400" />{client.email}</p>}
                          {client.phone && <p className="flex items-center gap-1.5"><Phone size={12} className="text-slate-400" />{client.phone}</p>}
                          {!client.email && !client.phone && <span className="text-slate-300">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {client.company ? <span className="inline-flex items-center gap-1.5"><Building2 size={13} className="text-slate-400" />{client.company}</span> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-500">{formatDate(client.createdAt)}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                          <button type="button" onClick={() => openEdit(client)} className="rounded-lg p-2 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600" aria-label={`Edit ${client.name}`}>
                            <Pencil size={15} />
                          </button>
                          <button type="button" onClick={() => setDeleting(client)} className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${client.name}`}>
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
            <ul className="divide-y divide-slate-100 md:hidden">
              {filtered.map((client) => (
                <li key={client._id} className="flex items-start gap-3 px-5 py-4">
                  <Avatar name={client.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-800">{client.name}</p>
                    {client.company && <p className="truncate text-xs text-slate-500">{client.company}</p>}
                    {client.email && <p className="truncate text-xs text-slate-400">{client.email}</p>}
                    {client.phone && <p className="truncate text-xs text-slate-400">{client.phone}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => openEdit(client)} className="rounded-lg p-2 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600" aria-label={`Edit ${client.name}`}>
                      <Pencil size={15} />
                    </button>
                    <button type="button" onClick={() => setDeleting(client)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${client.name}`}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <ClientFormModal open={formOpen} onClose={() => setFormOpen(false)} client={editing} onSaved={refetch} />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={deleteBusy}
        title="Delete client"
        message={`Permanently delete “${deleting?.name}”? Their projects must be deleted or reassigned first — the server blocks this with a conflict while projects still reference the client.`}
        confirmLabel="Delete client"
      />
    </div>
  );
}
