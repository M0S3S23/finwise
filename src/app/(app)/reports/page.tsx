'use client';
import { useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { useApp } from '@/components/app-context';
import { Button, Card, ErrorBlock, Input, LoadingBlock, PageHeader, Select } from '@/components/ui';
import { CashflowChart, RankedBars, SERIES } from '@/components/charts';
import { downloadUrl } from '@/lib/client';
import { PERIODS, periodRange, toDateInput, formatDate, type Period } from '@/lib/dates';
import { cn } from '@/lib/utils';

type Row = { name: string; total: number; count: number; inventory?: boolean };
type Report = {
  summary: {
    range: { from: string; to: string };
    totalIncome: number; totalExpenses: number; netCashFlow: number; salesRevenue: number; salesCount: number; discounts: number;
    cogs: number; grossProfit: number; grossMargin: number; operatingExpenses: number; inventoryPurchases: number; netProfit: number; netMargin: number;
    income: Row[]; expenses: Row[];
  };
  series: { points: { label: string; income: number; expense: number; net: number }[] };
  topProducts: { name: string; quantity: number; revenue: number; profit: number }[];
  inventory: { productCount: number; stockValue: number; retailValue: number; potentialProfit: number; lowStockCount: number; outOfStock: number };
};

export default function ReportsPage() {
  const { money, business } = useApp();
  const init = periodRange('month');
  const [period, setPeriod] = useState<Period>('month');
  const [from, setFrom] = useState(toDateInput(init.from));
  const [to, setTo] = useState(toDateInput(init.to));
  const choose = (p: Period) => {
    setPeriod(p);
    if (p !== 'custom') { const r = periodRange(p); setFrom(toDateInput(r.from)); setTo(toDateInput(r.to)); }
  };
  const { data, error, loading, reload } = useApi<Report>(`/api/reports/summary?from=${from}&to=${to}`);
  const s = data?.summary;
  const otherIncome = s ? s.totalIncome - s.salesRevenue : 0;

  return (
    <>
      <PageHeader title="Reports" subtitle={s ? `${business.name} · ${formatDate(s.range.from)} – ${formatDate(s.range.to)}` : business.name}
        actions={<>
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print / PDF</Button>
        </>} />

      <div className="no-print card mb-4 flex flex-wrap items-end gap-2 p-3">
        <Select value={period} onChange={(e) => choose(e.target.value as Period)} className="w-auto" aria-label="Period">
          {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          <option value="custom">Custom range</option>
        </Select>
        <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPeriod('custom'); }} className="w-auto" aria-label="From" />
        <span className="pb-2 text-slate-400">to</span>
        <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPeriod('custom'); }} className="w-auto" aria-label="To" />
        <div className="ml-auto flex flex-wrap gap-2">
          {(['transactions', 'sales', 'inventory'] as const).map((k) => (
            <Button key={k} variant="outline" size="sm" onClick={() => downloadUrl(`/api/reports/export?kind=${k}${k !== 'inventory' ? `&from=${from}&to=${to}` : ''}`)}>
              <Download className="h-3.5 w-3.5" /> {k[0].toUpperCase() + k.slice(1)} CSV
            </Button>
          ))}
        </div>
      </div>

      {error && !data && <ErrorBlock message={error} onRetry={reload} />}
      {!data && loading && <LoadingBlock />}
      {s && data && (
        <div className={cn('space-y-4', loading && 'opacity-60')}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="Profit & loss statement">
              <Statement rows={[
                { label: 'Sales revenue', value: s.salesRevenue, sub: `${s.salesCount} sales${s.discounts ? ` · ${money(s.discounts)} discounts given` : ''}` },
                ...(otherIncome ? [{ label: 'Other income', value: otherIncome }] : []),
                { label: 'Total revenue', value: s.totalIncome, strong: true },
                { label: 'Cost of goods sold', value: -s.cogs },
                { label: 'Gross profit', value: s.totalIncome - s.cogs, strong: true, sub: `${s.grossMargin}% gross margin on sales` },
                ...s.expenses.filter((e) => !e.inventory).map((e) => ({ label: e.name, value: -e.total, indent: true })),
                { label: 'Total operating expenses', value: -s.operatingExpenses },
                { label: 'Net profit', value: s.netProfit, total: true, sub: `${s.netMargin}% net margin` },
              ]} money={money} />
              <p className="mt-4 text-xs text-slate-500">Stock purchases are not counted as expenses here — their cost is counted as <em>cost of goods sold</em> when items sell.</p>
            </Card>
            <Card title="Cash flow">
              <Statement rows={[
                ...s.income.map((r) => ({ label: r.name, value: r.total, indent: true })),
                { label: 'Total money in', value: s.totalIncome, strong: true },
                ...s.expenses.map((r) => ({ label: r.name, value: -r.total, indent: true })),
                { label: 'Total money out', value: -s.totalExpenses, strong: true },
                { label: 'Net cash flow', value: s.netCashFlow, total: true },
              ]} money={money} />
              <p className="mt-4 text-xs text-slate-500">Actual money received and paid out in the period, including stock purchases.</p>
            </Card>
          </div>

          <Card title="Income vs expenses over time"><CashflowChart data={data.series.points} height={300} /></Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="Expenses by category">
              <RankedBars rows={s.expenses.map((e) => ({ name: e.name, value: e.total, sub: `${e.count}×` }))} valueLabel={(n) => `${money(n)} · ${s.totalExpenses ? Math.round((n / s.totalExpenses) * 100) : 0}%`} color={SERIES.expense} empty="No expenses in this period" />
            </Card>
            <Card title="Income by category">
              <RankedBars rows={s.income.map((e) => ({ name: e.name, value: e.total, sub: `${e.count}×` }))} valueLabel={(n) => `${money(n)} · ${s.totalIncome ? Math.round((n / s.totalIncome) * 100) : 0}%`} color={SERIES.income} empty="No income in this period" />
            </Card>
          </div>

          <Card title="Product performance" bodyClassName="p-0">
            {data.topProducts.length === 0 ? <p className="p-6 text-center text-sm text-slate-400">No sales in this period</p> : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead><tr><th>Product</th><th className="text-right">Qty sold</th><th className="text-right">Revenue</th><th className="text-right">Gross profit</th><th className="text-right">Margin</th></tr></thead>
                  <tbody>{data.topProducts.map((p) => (
                    <tr key={p.name}><td className="font-medium">{p.name}</td><td className="tabular text-right">{p.quantity}</td><td className="tabular text-right">{money(p.revenue)}</td><td className="tabular text-right">{money(p.profit)}</td><td className="tabular text-right text-slate-500">{p.revenue ? ((p.profit / p.revenue) * 100).toFixed(1) : 0}%</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Inventory position (today)">
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <KV label="Products" value={String(data.inventory.productCount)} />
              <KV label="Stock value at cost" value={money(data.inventory.stockValue)} />
              <KV label="Stock value at retail" value={money(data.inventory.retailValue)} />
              <KV label="Potential profit" value={money(data.inventory.potentialProfit)} />
              <KV label="Low stock items" value={String(data.inventory.lowStockCount)} />
              <KV label="Out of stock" value={String(data.inventory.outOfStock)} />
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

type SRow = { label: string; value: number; sub?: string; strong?: boolean; total?: boolean; indent?: boolean };
function Statement({ rows, money }: { rows: SRow[]; money: (n: number) => string }) {
  return (
    <dl className="text-sm">
      {rows.map((r, i) => (
        <div key={i} className={cn('flex items-baseline justify-between gap-4 py-1.5', r.strong && 'border-t border-slate-100 font-semibold', r.total && 'mt-1 border-t-2 border-slate-800 pt-2 text-base font-bold', r.indent && 'pl-4 text-slate-600')}>
          <dt>{r.label}{r.sub && <span className="block text-xs font-normal text-slate-500">{r.sub}</span>}</dt>
          <dd className={cn('tabular whitespace-nowrap', r.value < 0 && !r.indent && 'text-slate-700', r.total && r.value < 0 && 'text-red-600')}>
            {r.value < 0 ? `(${money(-r.value)})` : money(r.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
function KV({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-slate-500">{label}</p><p className="tabular font-semibold">{value}</p></div>;
}
