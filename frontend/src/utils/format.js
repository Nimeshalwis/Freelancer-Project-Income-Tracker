const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// The backend assumes one shared currency but does not expose it — see flagged contract gaps.
export const formatCurrency = (value) => currencyFormatter.format(Number.isFinite(value) ? value : 0);

export const formatCompactCurrency = (value) => {
  const n = Number.isFinite(value) ? value : 0;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 10_000) return `$${(n / 1000).toFixed(1)}k`;
  return currencyFormatter.format(n);
};

export const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

/** "2026-03" -> "Mar 2026" */
export const formatMonthLabel = (month) => {
  const [y, m] = String(month || '').split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return month;
  return `${new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ${y}`;
};

/** Date (or ISO string) -> "YYYY-MM-DDTHH:mm" for datetime-local inputs (local time). */
export const toDateTimeLocal = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** datetime-local value -> ISO string, or null when empty. */
export const fromDateTimeLocal = (value) => (value ? new Date(value).toISOString() : null);

export const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || '')
    .join('') || '?';
