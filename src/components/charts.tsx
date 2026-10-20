'use client';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import { useState } from 'react';
import { useApp } from './app-context';

// Validated pair (CVD ΔE 10.8, normal ΔE 27): income = teal, expense = orange.
export const SERIES = { income: '#0d9488', expense: '#e86a33' };
const INK_MUTED = '#64748b';
const GRID = '#eef2f6';

type Point = { label: string; income: number; expense: number; net: number };

function CashTooltip({ active, payload, label }: TooltipProps<number, string>) {
  const { money } = useApp();
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as Point;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-slate-800">{label}</p>
      <Row color={SERIES.income} label="Income" value={money(p.income)} />
      <Row color={SERIES.expense} label="Expenses" value={money(p.expense)} />
      <div className="mt-1 border-t border-slate-100 pt-1"><Row label="Net" value={money(p.net)} /></div>
    </div>
  );
}
function Row({ color, label, value }: { color?: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-6 py-0.5">
      <span className="flex items-center gap-1.5 text-slate-600">{color && <span className="h-2 w-2 rounded-sm" style={{ background: color }} />}{label}</span>
      <span className="tabular font-medium text-slate-900">{value}</span>
    </div>
  );
}

export function Legend() {
  return (
    <div className="flex items-center gap-4 text-xs text-slate-600">
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES.income }} />Income</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES.expense }} />Expenses</span>
    </div>
  );
}

/** Income vs expenses over time — grouped bars, one y-axis, crosshair tooltip, optional table view. */
export function CashflowChart({ data, height = 280 }: { data: Point[]; height?: number }) {
  const { money } = useApp();
  const [table, setTable] = useState(false);
  const empty = data.every((d) => d.income === 0 && d.expense === 0);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Legend />
        <button onClick={() => setTable((t) => !t)} className="text-xs font-medium text-slate-500 hover:text-slate-800">{table ? 'Show chart' : 'Show table'}</button>
      </div>
      {table ? (
        <div className="max-h-[280px] overflow-auto rounded-lg border border-slate-100">
          <table className="table-base">
            <thead><tr><th>Period</th><th className="text-right">Income</th><th className="text-right">Expenses</th><th className="text-right">Net</th></tr></thead>
            <tbody>{data.map((d) => (
              <tr key={d.label}><td>{d.label}</td><td className="tabular text-right">{money(d.income)}</td><td className="tabular text-right">{money(d.expense)}</td><td className="tabular text-right font-medium">{money(d.net)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      ) : empty ? (
        <div className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>No transactions in this period yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} barGap={2} barCategoryGap={data.length > 20 ? '15%' : '25%'} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: INK_MUTED, fontSize: 11 }} minTickGap={16} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: INK_MUTED, fontSize: 11 }} width={56} tickFormatter={(v: number) => money(v, true)} />
            <Tooltip content={<CashTooltip />} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
            <Bar dataKey="income" name="Income" fill={SERIES.income} radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="expense" name="Expenses" fill={SERIES.expense} radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

/** Ranked horizontal bars in plain HTML — single hue (magnitude), value labels in ink, hover title. */
export function RankedBars({ rows, color = SERIES.expense, valueLabel, empty = 'No data yet' }: {
  rows: { name: string; value: number; sub?: string }[]; color?: string; valueLabel: (n: number) => string; empty?: string;
}) {
  if (!rows.length) return <p className="py-8 text-center text-sm text-slate-400">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.name} title={`${r.name}: ${valueLabel(r.value)} (${total ? Math.round((r.value / total) * 100) : 0}%)`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-slate-700">{r.name}{r.sub && <span className="ml-1.5 text-xs text-slate-400">{r.sub}</span>}</span>
            <span className="tabular shrink-0 font-medium text-slate-900">{valueLabel(r.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full" style={{ width: `${Math.max((r.value / max) * 100, 1.5)}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
