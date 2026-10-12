import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, FolderKanban, Wallet, TrendingUp, X, Zap } from 'lucide-react';

export const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/payments', label: 'Payments', icon: Wallet },
  { to: '/income', label: 'Income Analytics', icon: TrendingUp },
];

export default function Sidebar({ open = false, onClose, summary }) {
  return (
    <>
      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm lg:hidden" onClick={onClose} aria-hidden="true" />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-800 bg-slate-900 transition-transform duration-200 lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-6 py-5">
          <NavLink to="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/40">
              <Zap size={18} className="text-white" />
            </span>
            <span className="leading-tight">
              <span className="block text-[15px] font-bold tracking-tight text-white">FreelanceHub</span>
              <span className="block text-[11px] font-medium text-slate-400">Project &amp; Income Tracker</span>
            </span>
          </NavLink>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden" aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>

        <nav className="mt-2 flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label="Main navigation">
          <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Workspace</p>
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-500/15 text-indigo-300 ring-1 ring-inset ring-indigo-500/30'
                    : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
                }`
              }
            >
              <Icon size={17} className="shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {summary && (
          <div className="mx-3 mb-3 rounded-xl bg-slate-800/60 p-4 ring-1 ring-inset ring-slate-700/60">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Outstanding</p>
            <p className="mt-1 text-xl font-bold tracking-tight text-white">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(summary.pendingPayments ?? 0)}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">pending across all projects</p>
          </div>
        )}

        <div className="border-t border-slate-800 px-6 py-4">
          <p className="text-[11px] text-slate-500">Secure JWT session · v0.1</p>
        </div>
      </aside>
    </>
  );
}
