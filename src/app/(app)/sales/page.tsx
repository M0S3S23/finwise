'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Plus, Receipt } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { useApp } from '@/components/app-context';
import { Badge, Button, Card, EmptyState, ErrorBlock, Input, LoadingBlock, PageHeader, Pagination, Select } from '@/components/ui';
import { formatDate } from '@/lib/dates';
import { paymentLabel } from '@/lib/money';

type Sale = { _id: string; number: number; date: string; total: number; costTotal: number; items: { name: string; quantity: number }[]; paymentMethod: string; customerName?: string; status: string; userName?: string };

export default function SalesPage() {
  const { money, can } = useApp();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [from, to, status]);
  const params = new URLSearchParams({ page: String(page), ...(from && { from }), ...(to && { to }), ...(status && { status }) });
  const { data, error, reload } = useApi<{ items: Sale[]; page: number; pages: number; total: number; summary: { revenue: number; count: number } }>(`/api/sales?${params}`);
  const owner = can('sales:void');

  return (
    <>
      <PageHeader title="Sales history" subtitle={owner ? 'All sales across your team.' : 'Sales you have made.'}
        actions={<Link href="/sales/new"><Button><Plus className="h-4 w-4" /> New sale</Button></Link>} />
      <div className="card mb-4 grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option><option value="completed">Completed</option><option value="voided">Voided</option>
        </Select>
        {data && <div className="flex items-center justify-end text-sm text-slate-600"><span><strong className="tabular">{money(data.summary.revenue)}</strong> from {data.summary.count} sales</span></div>}
      </div>
      <Card bodyClassName="p-0">
        {error && !data ? <div className="p-4"><ErrorBlock message={error} onRetry={reload} /></div>
          : !data ? <LoadingBlock />
          : data.items.length === 0 ? <EmptyState icon={<Receipt className="h-6 w-6" />} title="No sales found" text="Completed sales will appear here." action={<Link href="/sales/new"><Button>Make a sale</Button></Link>} />
          : (
            <>
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead><tr><th>#</th><th>Date</th><th>Items</th><th className="hidden md:table-cell">Payment</th>{owner && <th className="hidden lg:table-cell">Sold by</th>}<th className="text-right">Total</th>{owner && <th className="hidden text-right sm:table-cell">Profit</th>}</tr></thead>
                  <tbody>
                    {data.items.map((s) => (
                      <tr key={s._id} className="cursor-pointer hover:bg-slate-50/60">
                        <td><Link href={`/sales/${s._id}`} className="font-medium text-brand-700 hover:underline">#{s.number}</Link></td>
                        <td className="whitespace-nowrap text-slate-500">{formatDate(s.date, true)}</td>
                        <td>
                          <Link href={`/sales/${s._id}`} className="block max-w-[220px] truncate text-slate-800">{s.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</Link>
                          {s.customerName && <span className="text-xs text-slate-400">{s.customerName}</span>}
                          {s.status === 'voided' && <Badge tone="red" className="ml-1">Voided</Badge>}
                        </td>
                        <td className="hidden text-slate-600 md:table-cell">{paymentLabel(s.paymentMethod)}</td>
                        {owner && <td className="hidden text-slate-600 lg:table-cell">{s.userName}</td>}
                        <td className={`tabular whitespace-nowrap text-right font-medium ${s.status === 'voided' ? 'text-slate-400 line-through' : ''}`}>{money(s.total)}</td>
                        {owner && <td className="tabular hidden whitespace-nowrap text-right text-slate-600 sm:table-cell">{s.status === 'voided' ? '—' : money(s.total - s.costTotal)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={data.page} pages={data.pages} onPage={setPage} />
            </>
          )}
      </Card>
    </>
  );
}
