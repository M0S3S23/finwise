'use client';
import Link from 'next/link';
import { useState } from 'react';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Boxes, Minus, Plus, ShoppingCart, TrendingUp, Wallet } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { useApp } from '@/components/app-context';
import { Badge, Button, Card, ErrorBlock, LoadingBlock, PageHeader } from '@/components/ui';
import { Stat, pctChange } from '@/components/stat';
import { CashflowChart, RankedBars, SERIES } from '@/components/charts';
import { PeriodSelect } from '@/components/period-select';
import { TransactionModal, type Tx } from '@/components/transaction-form';
import { formatDate, type Period } from '@/lib/dates';

type Summary = {
  totalIncome: number; totalExpenses: number; netCashFlow: number; salesRevenue: number; salesCount: number;
  cogs: number; grossProfit: number; grossMargin: number; operatingExpenses: number; netProfit: number; netMargin: number;
  expenses: { name: string; total: number; inventory: boolean }[]; income: { name: string; total: number }[];
};
type Dash = {
  summary: Summary;
  previous: { totalIncome: number; totalExpenses: number; netProfit: number; salesRevenue: number };
  series: { points: { label: string; income: number; expense: number; net: number }[] };
  topProducts: { name: string; quantity: number; revenue: number; profit: number }[];
  inventory: { productCount: number; stockValue: number; retailValue: number; lowStockCount: number; outOfStock: number; lowStock: { _id: string; name: string; quantity: number; unit: string; reorderLevel: number }[] };
  recent: Tx[];
};

export default function DashboardPage() {
  const { user, money } = useApp();
  const [period, setPeriod] = useState<Period>('month');
  const [modal, setModal] = useState<null | 'income' | 'expense'>(null);
  const { data, error, loading, reload } = useApi<Dash>(`/api/dashboard?period=${period}`);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <PageHeader
        title={`${greet}, ${user.name.split(' ')[0]}`}
        subtitle="Here's how your business is doing."
        actions={<>
          <PeriodSelect value={period} onChange={setPeriod} />
          <Button variant="outline" onClick={() => setModal('expense')}><Minus className="h-4 w-4" /> Expense</Button>
          <Button variant="outline" onClick={() => setModal('income')}><Plus className="h-4 w-4" /> Income</Button>
          <Link href="/sales/new"><Button><ShoppingCart className="h-4 w-4" /> New sale</Button></Link>
        </>}
      />
      {error && !data && <ErrorBlock message={error} onRetry={reload} />}
      {loading && !data && <LoadingBlock />}
      {data && (
        <div className={loading ? 'opacity-60 transition-opacity' : ''}>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <Stat label="Income" value={money(data.summary.totalIncome)} icon={<ArrowDownLeft className="h-4 w-4" />} change={pctChange(data.summary.totalIncome, data.previous.totalIncome)} />
            <Stat label="Expenses" value={money(data.summary.totalExpenses)} icon={<ArrowUpRight className="h-4 w-4" />} change={pctChange(data.summary.totalExpenses, data.previous.totalExpenses)} goodWhenUp={false} />
            <Stat label="Net profit" value={money(data.summary.netProfit)} icon={<TrendingUp className="h-4 w-4" />} change={pctChange(data.summary.netProfit, data.previous.netProfit)} hint={data.summary.totalIncome ? `${data.summary.netMargin}% margin` : undefined} />
            <Stat label="Stock value" value={money(data.inventory.stockValue)} icon={<Boxes className="h-4 w-4" />} hint={`${data.inventory.productCount} products at cost`} />
          </div>

          {data.inventory.lowStockCount > 0 && (
            <Link href="/inventory?stock=low" className="mt-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
              <span><strong>{data.inventory.lowStockCount} product{data.inventory.lowStockCount > 1 ? 's' : ''}</strong> running low{data.inventory.outOfStock ? ` (${data.inventory.outOfStock} out of stock)` : ''}. Restock soon.</span>
              <span className="ml-auto font-medium">View →</span>
            </Link>
          )}

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card title="Income vs expenses" className="lg:col-span-2"><CashflowChart data={data.series.points} /></Card>
            <Card title="Sales performance">
              <dl className="space-y-3 text-sm">
                <Line label="Sales revenue" value={money(data.summary.salesRevenue)} />
                <Line label="Number of sales" value={String(data.summary.salesCount)} />
                <Line label="Avg. sale value" value={money(data.summary.salesCount ? data.summary.salesRevenue / data.summary.salesCount : 0)} />
                <Line label="Cost of goods sold" value={money(data.summary.cogs)} />
                <div className="border-t border-slate-100 pt-3"><Line label="Gross profit" value={money(data.summary.grossProfit)} strong /></div>
                <Line label="Gross margin" value={`${data.summary.grossMargin}%`} />
              </dl>
            </Card>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card title="Where money went" action={<Link href="/reports" className="text-xs font-medium text-brand-700">Reports →</Link>}>
              <RankedBars rows={data.summary.expenses.slice(0, 6).map((e) => ({ name: e.name, value: e.total }))} valueLabel={(n) => money(n)} color={SERIES.expense} empty="No expenses recorded" />
            </Card>
            <Card title="Top products">
              <RankedBars rows={data.topProducts.map((p) => ({ name: p.name, value: p.revenue, sub: `${p.quantity} sold` }))} valueLabel={(n) => money(n)} color={SERIES.income} empty="No sales yet" />
            </Card>
            <Card title="Recent activity" action={<Link href="/transactions" className="text-xs font-medium text-brand-700">All →</Link>} bodyClassName="p-0">
              {data.recent.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400"><Wallet className="mx-auto mb-2 h-6 w-6" />Nothing recorded yet</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.recent.map((t) => (
                    <li key={t._id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${t.type === 'income' ? 'bg-teal-50 text-teal-700' : 'bg-orange-50 text-orange-700'}`}>
                        {t.type === 'income' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-slate-800">{t.description || t.categoryName}</p>
                        <p className="text-xs text-slate-500">{t.categoryName} · {formatDate(t.date)}</p>
                      </div>
                      <span className={`tabular text-sm font-medium ${t.type === 'income' ? 'text-teal-700' : 'text-slate-900'}`}>{t.type === 'income' ? '+' : '−'}{money(t.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {data.inventory.lowStock.length > 0 && (
            <Card title="Low stock" className="mt-4" bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead><tr><th>Product</th><th className="text-right">In stock</th><th className="text-right">Reorder at</th><th></th></tr></thead>
                  <tbody>{data.inventory.lowStock.map((p) => (
                    <tr key={p._id}>
                      <td><Link href={`/inventory/${p._id}`} className="font-medium text-slate-800 hover:text-brand-700">{p.name}</Link></td>
                      <td className="tabular text-right">{p.quantity} {p.unit}</td>
                      <td className="tabular text-right text-slate-500">{p.reorderLevel}</td>
                      <td className="text-right">{p.quantity <= 0 ? <Badge tone="red">Out of stock</Badge> : <Badge tone="amber">Low</Badge>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
      <TransactionModal open={!!modal} initialType={modal ?? 'expense'} onClose={() => setModal(null)} onSaved={reload} />
    </>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`tabular ${strong ? 'font-semibold text-slate-900' : 'font-medium text-slate-800'}`}>{value}</dd>
    </div>
  );
}
