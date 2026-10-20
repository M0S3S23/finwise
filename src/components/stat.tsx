import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/** KPI tile. `goodWhenUp` controls whether an increase is shown as positive (income) or negative (expenses). */
export function Stat({ label, value, icon, change, goodWhenUp = true, hint }: {
  label: string; value: string; icon?: ReactNode; change?: number | null; goodWhenUp?: boolean; hint?: string;
}) {
  const showChange = change !== undefined && change !== null && Number.isFinite(change);
  const good = showChange && (goodWhenUp ? change! >= 0 : change! <= 0);
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
      <p className="tabular mt-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{value}</p>
      <div className="mt-1 flex items-center gap-1 text-xs">
        {showChange && (
          <span className={cn('inline-flex items-center font-medium', good ? 'text-emerald-700' : 'text-red-600')}>
            {change! >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {Math.abs(change!).toFixed(0)}%
          </span>
        )}
        <span className="text-slate-500">{hint ?? (showChange ? 'vs previous period' : '')}</span>
      </div>
    </div>
  );
}

export function pctChange(cur: number, prev: number) {
  if (!prev) return cur ? null : 0;
  return ((cur - prev) / Math.abs(prev)) * 100;
}
