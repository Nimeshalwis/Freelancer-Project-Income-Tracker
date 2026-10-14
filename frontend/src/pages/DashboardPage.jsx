import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Target, Clock, FolderKanban, Users, Briefcase, ArrowUpRight, Plus } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Avatar from '../components/ui/Avatar.jsx';
import { Spinner, ErrorState } from '../components/ui/States.jsx';
import { MonthlyIncomeAreaChart, ProjectStatusPieChart, ProjectProgressBars } from '../components/charts/Charts.jsx';
import { useApi } from '../hooks/useApi.js';
import { dashboardApi, projectsApi, paymentsApi } from '../services/api.js';
import { formatDate } from '../utils/format.js';
import { useCurrency } from '../context/CurrencyContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const KPIS = [
  { key: 'totalIncome', label: 'Total income', icon: Wallet, accent: 'from-emerald-500 to-teal-500', money: true },
  { key: 'totalProjectValue', label: 'Project value', icon: Target, accent: 'from-indigo-500 to-violet-500', money: true },
  { key: 'pendingPayments', label: 'Outstanding', icon: Clock, accent: 'from-amber-500 to-orange-500', money: true },
  { key: 'activeProjects', label: 'Active projects', icon: FolderKanban, accent: 'from-sky-500 to-cyan-500' },
  { key: 'totalClients', label: 'Clients', icon: Users, accent: 'from-rose-500 to-pink-500' },
  { key: 'totalProjects', label: 'All projects', icon: Briefcase, accent: 'from-slate-600 to-slate-500' },
];

export default function DashboardPage() {
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();
  const summary = useApi(() => dashboardApi.summary().then((r) => r.data.data), []);
  const monthly = useApi(() => dashboardApi.monthlyIncome(String(new Date().getFullYear())).then((r) => r.data.data), []);
  const statusData = useApi(() => dashboardApi.projectStatus().then((r) => r.data.data), []);
  const projects = useApi(() => projectsApi.list(), []);
  const payments = useApi(() => paymentsApi.list(), []);

  const paidByProject = useMemo(() => {
    const map = {};
    for (const p of payments.data || []) {
      const pid = typeof p.project === 'object' ? p.project?._id : p.project;
      if (pid) map[pid] = (map[pid] || 0) + p.amount;
    }
    return map;
  }, [payments.data]);

  const topProjects = useMemo(() => {
    const list = (projects.data || []).slice(0, 6).map((p) => ({
      id: p._id,
      name: p.projectName,
      fee: p.fee,
      paid: Math.min(paidByProject[p._id] || 0, p.fee),
    }));
    return list.sort((a, b) => b.fee - a.fee);
  }, [projects.data, paidByProject]);

  const recentPayments = (payments.data || []).slice(0, 5);

  if (summary.loading && !summary.data) return <Spinner label="Loading your dashboard…" />;
  if (summary.error) return <Card><ErrorState error={summary.error} onRetry={summary.refetch} /></Card>;

  const s = summary.data || {};
  const thisYear = new Date().getFullYear();
  const yearTotal = (monthly.data || []).reduce((sum, row) => sum + row.totalIncome, 0);

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Welcome back, {user?.name?.split(' ')[0] || 'freelancer'} 👋
          </h2>
          <p className="mt-1 text-sm text-slate-500">Here's how your business is performing in {thisYear}.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/projects"><Button variant="secondary" size="sm" icon={Plus}>Project</Button></Link>
          <Link to="/payments"><Button size="sm" icon={Plus}>Record payment</Button></Link>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {KPIS.map(({ key, label, icon: Icon, accent, money }) => (
          <div key={key} className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-900/[0.03] transition hover:shadow-md sm:p-5">
            <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`} />
            <div className="flex items-center justify-between">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${accent} text-white shadow-sm`}>
                <Icon size={16} />
              </span>
            </div>
            <p className="mt-3 truncate text-xl font-bold tracking-tight text-slate-900 tabular-nums sm:text-2xl">
              {money ? formatCurrency(s[key]) : (s[key] ?? 0)}
            </p>
            <p className="mt-0.5 text-xs font-medium text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title={`Monthly income · ${thisYear}`}
          subtitle={`${formatCurrency(yearTotal)} received across ${thisYear} (all-time totals above)`}
          action={<Link to="/income" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700">Analytics <ArrowUpRight size={13} /></Link>}
        >
          {monthly.loading ? <Spinner className="py-10" /> : monthly.error ? <ErrorState error={monthly.error} onRetry={monthly.refetch} /> : <MonthlyIncomeAreaChart data={monthly.data} />}
        </Card>

        <Card title="Project mix" subtitle="Count by status">
          {statusData.loading ? <Spinner className="py-10" /> : statusData.error ? <ErrorState error={statusData.error} onRetry={statusData.refetch} /> : <ProjectStatusPieChart data={statusData.data} />}
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Payment collection" subtitle="Top projects — recorded vs. agreed fee" action={<Link to="/projects" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">View projects</Link>}>
          {projects.loading ? <Spinner className="py-10" /> : <ProjectProgressBars data={topProjects} />}
        </Card>

        <Card title="Recent payments" action={<Link to="/payments" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">All payments</Link>}>
          {payments.loading ? (
            <Spinner className="py-10" />
          ) : recentPayments.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No payments recorded yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentPayments.map((payment) => {
                const projectName = typeof payment.project === 'object' ? payment.project?.projectName : 'Project';
                const clientName = typeof payment.project === 'object' ? payment.project?.client?.name : null;
                const status = typeof payment.project === 'object' ? payment.project?.status : null;
                return (
                  <li key={payment._id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <Avatar name={clientName || projectName || '?'} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{projectName}</p>
                      <p className="truncate text-xs text-slate-400">{payment.paymentMethod} · {formatDate(payment.paymentDate)}</p>
                    </div>
                    {status && <StatusBadge status={status} />}
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-emerald-600">+{formatCurrency(payment.amount)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
