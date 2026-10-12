import { useMemo, useState } from 'react';
import { TrendingUp, Wallet, CalendarClock, ArrowDownRight } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Avatar from '../components/ui/Avatar.jsx';
import { Select } from '../components/ui/FormControls.jsx';
import { Spinner, ErrorState } from '../components/ui/States.jsx';
import { MonthlyIncomeAreaChart, MonthlyIncomeBarChart, ProjectStatusPieChart } from '../components/charts/Charts.jsx';
import { useApi } from '../hooks/useApi.js';
import { dashboardApi, projectsApi, paymentsApi } from '../services/api.js';
import { formatCurrency, formatDate } from '../utils/format.js';

export default function IncomePage() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(String(thisYear));
  const [chartType, setChartType] = useState('area');

  // Year options: current year back to the earliest payment we know about.
  const { data: payments } = useApi(() => paymentsApi.list(), []);
  const yearOptions = useMemo(() => {
    const years = new Set([String(thisYear)]);
    for (const p of payments || []) {
      const y = new Date(p.paymentDate).getFullYear();
      if (Number.isFinite(y) && y >= thisYear - 10) years.add(String(y));
    }
    return [...years].sort((a, b) => Number(b) - Number(a));
  }, [payments, thisYear]);

  const monthly = useApi(() => dashboardApi.monthlyIncome(year).then((r) => r.data.data), [year]);
  const summary = useApi(() => dashboardApi.summary().then((r) => r.data.data), []);
  const statusData = useApi(() => dashboardApi.projectStatus().then((r) => r.data.data), []);
  const projects = useApi(() => projectsApi.list(), []);

  const s = summary.data || {};
  const rows = monthly.data || [];
  const yearTotal = rows.reduce((sum, row) => sum + row.totalIncome, 0);
  const bestMonth = rows.reduce((best, row) => (row.totalIncome > (best?.totalIncome ?? 0) ? row : best), null);
  const avgMonth = rows.some((r) => r.totalIncome > 0) ? yearTotal / 12 : 0;

  // Top outstanding balances per project (fee − recorded payments), client-side aggregation.
  const outstanding = useMemo(() => {
    const paidByProject = {};
    for (const p of payments || []) {
      const pid = typeof p.project === 'object' ? p.project?._id : p.project;
      if (pid) paidByProject[pid] = (paidByProject[pid] || 0) + p.amount;
    }
    return (projects.data || [])
      .map((project) => ({
        id: project._id,
        name: project.projectName,
        clientName: typeof project.client === 'object' ? project.client?.name : null,
        status: project.status,
        fee: project.fee,
        paid: paidByProject[project._id] || 0,
        remaining: Math.max(project.fee - (paidByProject[project._id] || 0), 0),
      }))
      .filter((row) => row.remaining > 0)
      .sort((a, b) => b.remaining - a.remaining)
      .slice(0, 8);
  }, [projects.data, payments]);

  const Chart = chartType === 'bar' ? MonthlyIncomeBarChart : MonthlyIncomeAreaChart;

  return (
    <div className="space-y-6">
      {/* Stat strip */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: `Income in ${year}`, value: formatCurrency(yearTotal), icon: Wallet, tone: 'text-emerald-600 bg-emerald-50' },
          { label: 'All-time income', value: formatCurrency(s.totalIncome ?? 0), icon: TrendingUp, tone: 'text-indigo-600 bg-indigo-50' },
          { label: 'Outstanding balance', value: formatCurrency(s.pendingPayments ?? 0), icon: CalendarClock, tone: 'text-amber-600 bg-amber-50' },
          { label: bestMonth ? `Best month (${formatDate(`01-${bestMonth.month}-01`).split(' ')[0]})` : 'Best month', value: bestMonth ? formatCurrency(bestMonth.totalIncome) : '—', icon: ArrowDownRight, tone: 'text-sky-600 bg-sky-50' },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon size={19} /></span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-500">{label}</p>
              <p className="truncate text-lg font-bold tracking-tight tabular-nums text-slate-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title={`Monthly income · ${year}`}
          subtitle={avgMonth ? `Averages ${formatCurrency(avgMonth)} / month with payments counted by payment date.` : 'No payments recorded for this year yet.'}
          action={
            <div className="flex items-center gap-2">
              <Select aria-label="Year" className="h-9 w-24 text-xs" value={year} onChange={(e) => setYear(e.target.value)} options={yearOptions} />
              <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                {['area', 'bar'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setChartType(type)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition ${chartType === type ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          }
        >
          {monthly.loading ? <Spinner className="py-12" /> : monthly.error ? <ErrorState error={monthly.error} onRetry={monthly.refetch} /> : <Chart data={monthly.data} height={320} />}
        </Card>

        <Card title="Project mix" subtitle="GET /api/dashboard/project-status">
          {statusData.loading ? <Spinner className="py-12" /> : statusData.error ? <ErrorState error={statusData.error} onRetry={statusData.refetch} /> : <ProjectStatusPieChart data={statusData.data} height={300} />}
        </Card>
      </div>

      <Card
        title="Outstanding balances"
        subtitle="Aggregated client-side from GET /api/projects and GET /api/payments (fee − recorded payments)"
        bodyClassName="p-0"
      >
        {projects.loading || !payments ? (
          <Spinner />
        ) : outstanding.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-400">🎉 Everything is fully paid — no outstanding balances.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {outstanding.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 sm:flex-nowrap sm:px-6">
                <Avatar name={row.clientName || row.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{row.name}</p>
                  <p className="truncate text-xs text-slate-400">{row.clientName || '—'} · Fee {formatCurrency(row.fee)} · Paid {formatCurrency(row.paid)}</p>
                </div>
                <StatusBadge status={row.status} />
                <span className="w-24 text-right text-sm font-bold tabular-nums text-amber-600">{formatCurrency(row.remaining)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
