'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, Pencil, Plus, Search, Trash2, Wallet } from 'lucide-react';
import { useApi, useDebounced } from '@/hooks/useApi';
import { useApp } from '@/components/app-context';
import { Badge, Button, Card, EmptyState, ErrorBlock, Input, LoadingBlock, PageHeader, Pagination, Select } from '@/components/ui';
import { TransactionModal, useCategories, type Tx } from '@/components/transaction-form';
import { useToast } from '@/components/toast';
import { api } from '@/lib/client';
import { formatDate } from '@/lib/dates';
import { PAYMENT_METHODS, paymentLabel } from '@/lib/money';

type List = { items: Tx[]; total: number; page: number; pages: number; totals: { income: number; expense: number; net: number } };

export default function TransactionsPage() {
  const { money, can } = useApp();
  const toast = useToast();
  const cats = useCategories();
  const [type, setType] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const [modal, setModal] = useState<{ type: 'income' | 'expense'; editing?: Tx } | null>(null);

  useEffect(() => setPage(1), [type, categoryId, paymentMethod, from, to, dq]);
  const params = new URLSearchParams({ page: String(page), ...(type && { type }), ...(categoryId && { categoryId }), ...(paymentMethod && { paymentMethod }), ...(from && { from }), ...(to && { to }), ...(dq && { q: dq }) });
  const { data, error, loading, reload } = useApi<List>(`/api/transactions?${params}`);
  const canEdit = can('transactions:edit');

  const remove = async (t: Tx) => {
    if (!confirm(`Delete this ${t.type} of ${money(t.amount)}? This cannot be undone.`)) return;
    try { await api(`/api/transactions/${t._id}`, { method: 'DELETE' }); toast('Transaction deleted'); reload(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Delete failed', 'error'); }
  };
  const hasFilters = type || categoryId || paymentMethod || from || to || q;

  return (
    <>
      <PageHeader title="Income & expenses" subtitle={canEdit ? 'Every payment in and out of the business.' : 'Entries you have recorded.'}
        actions={<>
          <Button variant="outline" onClick={() => setModal({ type: 'expense' })}><ArrowUpRight className="h-4 w-4" /> Expense</Button>
          <Button onClick={() => setModal({ type: 'income' })}><Plus className="h-4 w-4" /> Income</Button>
        </>} />

      <div className="card mb-4 grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="relative col-span-2 sm:col-span-3 lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search description, ref…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select value={type} onChange={(e) => { setType(e.target.value); setCategoryId(''); }} aria-label="Type">
          <option value="">All types</option><option value="income">Income</option><option value="expense">Expenses</option>
        </Select>
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {cats.filter((c) => !type || c.type === type).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
        <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} aria-label="Payment method" className="lg:col-span-1">
          <option value="">All payment methods</option>
          {PAYMENT_METHODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </Select>
        {hasFilters && <Button variant="ghost" onClick={() => { setType(''); setCategoryId(''); setPaymentMethod(''); setFrom(''); setTo(''); setQ(''); }}>Clear filters</Button>}
      </div>

      {data && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          <MiniTotal label="Money in" value={money(data.totals.income)} tone="text-teal-700" />
          <MiniTotal label="Money out" value={money(data.totals.expense)} tone="text-orange-700" />
          <MiniTotal label="Net" value={money(data.totals.net)} tone={data.totals.net >= 0 ? 'text-slate-900' : 'text-red-600'} />
        </div>
      )}

      <Card bodyClassName="p-0">
        {error && !data ? <div className="p-4"><ErrorBlock message={error} onRetry={reload} /></div>
          : !data ? <LoadingBlock />
          : data.items.length === 0 ? (
            <EmptyState icon={<Wallet className="h-6 w-6" />} title={hasFilters ? 'No matching transactions' : 'No transactions yet'}
              text={hasFilters ? 'Try different filters.' : 'Record your first income or expense to start tracking your cash flow.'}
              action={!hasFilters && <Button onClick={() => setModal({ type: 'expense' })}><Plus className="h-4 w-4" /> Record transaction</Button>} />
          ) : (
            <>
              {/* Desktop table */}
              <div className={`hidden overflow-x-auto md:block ${loading ? 'opacity-60' : ''}`}>
                <table className="table-base">
                  <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Paid via</th><th className="text-right">Amount</th>{canEdit && <th className="w-20"></th>}</tr></thead>
                  <tbody>
                    {data.items.map((t) => (
                      <tr key={t._id} className="hover:bg-slate-50/60">
                        <td className="whitespace-nowrap text-slate-500">{formatDate(t.date)}</td>
                        <td>
                          <div className="max-w-xs truncate text-slate-800">{t.description || '—'}</div>
                          <div className="text-xs text-slate-400">
                            {t.source === 'sale' && t.saleId ? <Link href={`/sales/${t.saleId}`} className="text-brand-700 hover:underline">From sale</Link> : t.source === 'restock' ? 'Stock purchase' : t.userName}
                            {t.reference && ` · Ref ${t.reference}`}
                          </div>
                        </td>
                        <td><Badge tone={t.type === 'income' ? 'green' : 'slate'}>{t.categoryName}</Badge></td>
                        <td className="text-slate-600">{paymentLabel(t.paymentMethod)}</td>
                        <td className={`tabular whitespace-nowrap text-right font-medium ${t.type === 'income' ? 'text-teal-700' : 'text-slate-900'}`}>{t.type === 'income' ? '+' : '−'}{money(t.amount)}</td>
                        {canEdit && (
                          <td className="text-right">
                            {t.source === 'manual' && (
                              <div className="flex justify-end gap-1">
                                <button onClick={() => setModal({ type: t.type, editing: t })} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                                <button onClick={() => remove(t)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile list */}
              <ul className="divide-y divide-slate-100 md:hidden">
                {data.items.map((t) => (
                  <li key={t._id} className="flex items-center gap-3 px-4 py-3" onClick={() => canEdit && t.source === 'manual' && setModal({ type: t.type, editing: t })}>
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${t.type === 'income' ? 'bg-teal-50 text-teal-700' : 'bg-orange-50 text-orange-700'}`}>
                      {t.type === 'income' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{t.description || t.categoryName}</p>
                      <p className="text-xs text-slate-500">{t.categoryName} · {paymentLabel(t.paymentMethod)} · {formatDate(t.date)}</p>
                    </div>
                    <span className={`tabular text-sm font-semibold ${t.type === 'income' ? 'text-teal-700' : 'text-slate-900'}`}>{t.type === 'income' ? '+' : '−'}{money(t.amount)}</span>
                  </li>
                ))}
              </ul>
              <Pagination page={data.page} pages={data.pages} onPage={setPage} />
            </>
          )}
      </Card>
      <TransactionModal open={!!modal} initialType={modal?.type} editing={modal?.editing} onClose={() => setModal(null)} onSaved={reload} />
    </>
  );
}

function MiniTotal({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="card px-3 py-2.5 sm:px-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`tabular mt-0.5 truncate text-sm font-semibold sm:text-base ${tone}`}>{value}</p>
    </div>
  );
}
