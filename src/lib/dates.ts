export type Period = 'today' | '7d' | '30d' | 'month' | 'last_month' | 'quarter' | 'year' | 'custom';

export const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'year', label: 'This year' },
];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

export function periodRange(p: Period, now = new Date()): { from: Date; to: Date } {
  const to = endOfDay(now);
  switch (p) {
    case 'today': return { from: startOfDay(now), to };
    case '7d': return { from: startOfDay(new Date(now.getTime() - 6 * 864e5)), to };
    case '30d': return { from: startOfDay(new Date(now.getTime() - 29 * 864e5)), to };
    case 'last_month': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { from, to: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)) };
    }
    case 'quarter': return { from: new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1), to };
    case 'year': return { from: new Date(now.getFullYear(), 0, 1), to };
    case 'month':
    default: return { from: new Date(now.getFullYear(), now.getMonth(), 1), to };
  }
}

/** yyyy-mm-dd in local time (for <input type=date>). */
export function toDateInput(d: Date | string) {
  const x = new Date(d);
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${x.getFullYear()}-${m}-${day}`;
}

/** Parse a yyyy-mm-dd string as local date at start (or end) of day. */
export function fromDateInput(s: string, end = false) {
  const [y, m, d] = s.split('-').map(Number);
  return end ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d);
}

export function formatDate(d: Date | string, withTime = false) {
  const x = new Date(d);
  return x.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}
