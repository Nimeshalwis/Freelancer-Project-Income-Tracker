import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { formatCompactCurrency, formatCurrency, formatMonthLabel } from '../../utils/format.js';

const AXIS_PROPS = {
  tick: { fill: '#64748b', fontSize: 11 },
  axisLine: false,
  tickLine: false,
};

const tooltipStyle = {
  contentStyle: {
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    boxShadow: '0 8px 24px rgba(15,23,42,.08)',
    fontSize: 12,
    padding: '8px 12px',
  },
  labelStyle: { color: '#334155', fontWeight: 600, marginBottom: 2 },
  itemStyle: { padding: 0 },
};

export const STATUS_COLORS = { Pending: '#f59e0b', 'In Progress': '#0ea5e9', Completed: '#10b981' };

/** Monthly income area chart. data: [{ month, totalIncome, paymentCount }] */
export function MonthlyIncomeAreaChart({ data, height = 280 }) {
  const rows = (data || []).map((row) => ({ ...row, label: formatMonthLabel(row.month).replace(/ \d{4}$/, '') }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} width={56} tickFormatter={formatCompactCurrency} />
        <Tooltip
          {...tooltipStyle}
          formatter={(value) => [formatCurrency(value), 'Income']}
          labelFormatter={(label, props) => {
            const payload = props?.[0]?.payload;
            return payload ? `${label} · ${payload.paymentCount} payment${payload.paymentCount === 1 ? '' : 's'}` : label;
          }}
        />
        <Area type="monotone" dataKey="totalIncome" stroke="#6366f1" strokeWidth={2.5} fill="url(#incomeFill)" activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} name="Income" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Monthly income bar chart. */
export function MonthlyIncomeBarChart({ data, height = 280 }) {
  const rows = (data || []).map((row) => ({ ...row, label: formatMonthLabel(row.month).replace(/ \d{4}$/, '') }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} width={56} tickFormatter={formatCompactCurrency} />
        <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(99,102,241,0.06)' }} formatter={(value) => [formatCurrency(value), 'Income']} />
        <Bar dataKey="totalIncome" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={36} name="Income" />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Project status donut. data: [{ status, count }] */
export function ProjectStatusPieChart({ data, height = 260 }) {
  const rows = (data || []).filter((row) => row.count > 0);
  const total = (data || []).reduce((sum, row) => sum + (row.count || 0), 0);
  if (!rows.length) {
    return <div className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>No projects yet.</div>;
  }
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={rows} dataKey="count" nameKey="status" innerRadius="62%" outerRadius="88%" paddingAngle={3} strokeWidth={0}>
            {rows.map((row) => (
              <Cell key={row.status} fill={STATUS_COLORS[row.status] || '#94a3b8'} />
            ))}
          </Pie>
          <Tooltip {...tooltipStyle} formatter={(value, name) => [`${value} project${value === 1 ? '' : 's'}`, name]} />
          <Legend iconType="circle" iconSize={8} formatter={(value) => <span className="text-xs text-slate-600">{value}</span>} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-8">
        <span className="text-2xl font-bold tracking-tight text-slate-900">{total}</span>
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Projects</span>
      </div>
    </div>
  );
}

/** Horizontal fee-vs-paid bars per project. data: [{id, name, fee, paid}] */
export function ProjectProgressBars({ data }) {
  if (!data?.length) return <p className="py-8 text-center text-sm text-slate-400">No projects to compare yet.</p>;
  return (
    <ul className="space-y-5">
      {data.map((item) => {
        const pct = item.fee > 0 ? Math.min(100, Math.round((item.paid / item.fee) * 100)) : 0;
        return (
          <li key={item.id}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <p className="truncate text-sm font-medium text-slate-700">{item.name}</p>
              <p className="shrink-0 text-xs tabular-nums text-slate-500">
                {formatCurrency(item.paid)} <span className="text-slate-300">/</span> {formatCurrency(item.fee)}
                <span className={`ml-2 font-semibold ${pct >= 100 ? 'text-emerald-600' : pct > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>{pct}%</span>
              </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-violet-500'}`}
                style={{ width: `${Math.max(pct, item.paid > 0 ? 3 : 0)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
