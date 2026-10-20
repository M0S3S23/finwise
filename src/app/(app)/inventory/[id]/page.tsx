'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Archive, ArchiveRestore, ArrowLeft, PackagePlus, Pencil, Trash2 } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { useApp } from '@/components/app-context';
import { Badge, Button, Card, ErrorBlock, LoadingBlock, PageHeader } from '@/components/ui';
import { ProductModal, StockModal } from '@/components/product-modals';
import { useToast } from '@/components/toast';
import { api } from '@/lib/client';
import { formatDate } from '@/lib/dates';
import { formatNumber } from '@/lib/money';
import type { Product } from '@/lib/types';

type Movement = { _id: string; type: string; quantity: number; balanceAfter?: number; unitCost: number; note?: string; date: string; saleId?: string; userId?: { name: string } };
const TYPE_LABEL: Record<string, { label: string; tone: 'green' | 'blue' | 'amber' | 'slate' | 'red' }> = {
  initial: { label: 'Opening', tone: 'slate' }, restock: { label: 'Restock', tone: 'green' }, sale: { label: 'Sale', tone: 'blue' },
  adjustment: { label: 'Adjustment', tone: 'amber' }, void: { label: 'Void', tone: 'red' },
};

export default function ProductDetail({ params }: { params: { id: string } }) {
  const { money, can } = useApp();
  const toast = useToast();
  const router = useRouter();
  const { data, error, loading, reload } = useApi<{ product: Product & { archived: boolean; description?: string }; movements: Movement[] }>(`/api/products/${params.id}`);
  const [edit, setEdit] = useState(false);
  const [stock, setStock] = useState(false);
  const manage = can('inventory:manage');

  if (loading && !data) return <LoadingBlock />;
  if (error || !data) return <ErrorBlock message={error ?? 'Not found'} onRetry={reload} />;
  const p = data.product;

  const toggleArchive = async () => {
    await api(`/api/products/${p._id}`, { method: 'PATCH', json: { archived: !p.archived } });
    toast(p.archived ? 'Product restored' : 'Product archived');
    reload();
  };
  const remove = async () => {
    if (!confirm(`Delete ${p.name}?`)) return;
    try {
      const r = await api<{ archived?: boolean; message?: string }>(`/api/products/${p._id}`, { method: 'DELETE' });
      toast(r.message ?? 'Product deleted', r.archived ? 'info' : 'success');
      if (r.archived) reload(); else router.push('/inventory');
    } catch (e) { toast(e instanceof Error ? e.message : 'Failed', 'error'); }
  };

  return (
    <>
      <Link href="/inventory" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Inventory</Link>
      <PageHeader title={p.name} subtitle={[p.category, p.sku].filter(Boolean).join(' · ')}
        actions={manage && <>
          <Button variant="outline" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" /> Edit</Button>
          <Button variant="outline" onClick={toggleArchive}>{p.archived ? <><ArchiveRestore className="h-4 w-4" /> Restore</> : <><Archive className="h-4 w-4" /> Archive</>}</Button>
          <Button variant="ghost" className="text-red-600" onClick={remove}><Trash2 className="h-4 w-4" /></Button>
          <Button onClick={() => setStock(true)}><PackagePlus className="h-4 w-4" /> Stock</Button>
        </>} />
      {p.archived && <div className="mb-4 rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-600">This product is archived and hidden from sales.</div>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="In stock" value={`${formatNumber(p.quantity)} ${p.unit}`} badge={p.quantity <= 0 ? <Badge tone="red">Out</Badge> : p.quantity <= p.reorderLevel ? <Badge tone="amber">Low</Badge> : <Badge tone="green">OK</Badge>} />
        <Tile label="Selling price" value={money(p.sellingPrice)} />
        {manage && <Tile label="Avg. cost" value={money(p.costPrice)} sub={p.sellingPrice ? `${(((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100).toFixed(1)}% margin` : undefined} />}
        {manage && <Tile label="Stock value" value={money(Math.max(p.quantity, 0) * p.costPrice)} sub={`Alert at ${p.reorderLevel}`} />}
      </div>
      {p.description && <p className="mt-4 text-sm text-slate-600">{p.description}</p>}
      <Card title="Stock history" className="mt-4" bodyClassName="p-0">
        {data.movements.length === 0 ? <p className="p-6 text-center text-sm text-slate-400">No stock movements yet</p> : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Date</th><th>Type</th><th className="text-right">Change</th><th className="text-right">Balance</th><th className="hidden sm:table-cell">Note</th><th className="hidden md:table-cell">By</th></tr></thead>
              <tbody>{data.movements.map((m) => (
                <tr key={m._id}>
                  <td className="whitespace-nowrap text-slate-500">{formatDate(m.date, true)}</td>
                  <td><Badge tone={TYPE_LABEL[m.type]?.tone ?? 'slate'}>{TYPE_LABEL[m.type]?.label ?? m.type}</Badge></td>
                  <td className={`tabular text-right font-medium ${m.quantity > 0 ? 'text-emerald-700' : 'text-slate-800'}`}>{m.quantity > 0 ? '+' : ''}{formatNumber(m.quantity)}</td>
                  <td className="tabular text-right text-slate-600">{m.balanceAfter !== undefined ? formatNumber(m.balanceAfter) : '—'}</td>
                  <td className="hidden max-w-xs truncate text-slate-600 sm:table-cell">{m.saleId ? <Link href={`/sales/${m.saleId}`} className="text-brand-700 hover:underline">{m.note}</Link> : m.note}</td>
                  <td className="hidden text-slate-500 md:table-cell">{m.userId?.name}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>
      <ProductModal open={edit} editing={p} categories={[]} onClose={() => setEdit(false)} onSaved={reload} />
      {stock && <StockModal product={p} onClose={() => setStock(false)} onSaved={reload} />}
    </>
  );
}

function Tile({ label, value, sub, badge }: { label: string; value: string; sub?: string; badge?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between"><p className="text-xs font-medium uppercase text-slate-500">{label}</p>{badge}</div>
      <p className="tabular mt-1 text-lg font-semibold">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
