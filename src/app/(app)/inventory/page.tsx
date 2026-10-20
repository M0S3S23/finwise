'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Boxes, Download, PackagePlus, Pencil, Plus, Search } from 'lucide-react';
import { useApi, useDebounced } from '@/hooks/useApi';
import { useApp } from '@/components/app-context';
import { Badge, Button, Card, EmptyState, ErrorBlock, Input, LoadingBlock, PageHeader, Select } from '@/components/ui';
import { ProductModal, StockModal } from '@/components/product-modals';
import { downloadUrl } from '@/lib/client';
import { formatNumber } from '@/lib/money';
import type { Product } from '@/lib/types';

function InventoryInner() {
  const { money, can } = useApp();
  const sp = useSearchParams();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState(sp.get('stock') ?? '');
  const [archived, setArchived] = useState(false);
  const dq = useDebounced(q);
  const params = new URLSearchParams({ ...(dq && { q: dq }), ...(category && { category }), ...(stock && { stock }), ...(archived && { archived: '1' }) });
  const { data, error, loading, reload } = useApi<{ items: Product[]; categories: string[] }>(`/api/products?${params}`);
  const [editing, setEditing] = useState<Product | null | 'new'>(null);
  const [stockFor, setStockFor] = useState<Product | null>(null);
  const manage = can('inventory:manage');
  useEffect(() => { if (sp.get('new') === '1' && manage) setEditing('new'); }, [sp, manage]);

  const totals = (data?.items ?? []).reduce((a, p) => ({ value: a.value + Math.max(p.quantity, 0) * p.costPrice, retail: a.retail + Math.max(p.quantity, 0) * p.sellingPrice }), { value: 0, retail: 0 });

  return (
    <>
      <PageHeader title="Inventory" subtitle="Stock levels update automatically with every sale."
        actions={manage && <>
          <Button variant="outline" onClick={() => downloadUrl('/api/reports/export?kind=inventory')}><Download className="h-4 w-4" /> Export</Button>
          <Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Add product</Button>
        </>} />
      <div className="card mb-4 grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
        <div className="relative col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search name, SKU, category" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {data?.categories.map((c) => <option key={c}>{c}</option>)}
        </Select>
        <Select value={archived ? 'archived' : stock} onChange={(e) => { const v = e.target.value; setArchived(v === 'archived'); setStock(v === 'archived' ? '' : v); }} aria-label="Stock">
          <option value="">All stock levels</option><option value="low">Low stock</option><option value="out">Out of stock</option>
          {manage && <option value="archived">Archived</option>}
        </Select>
      </div>
      {manage && data && data.items.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="card px-4 py-2.5"><p className="text-[11px] font-medium uppercase text-slate-500">Products</p><p className="tabular font-semibold">{data.items.length}</p></div>
          <div className="card px-4 py-2.5"><p className="text-[11px] font-medium uppercase text-slate-500">Value at cost</p><p className="tabular truncate font-semibold">{money(totals.value)}</p></div>
          <div className="card px-4 py-2.5"><p className="text-[11px] font-medium uppercase text-slate-500">Value at retail</p><p className="tabular truncate font-semibold">{money(totals.retail)}</p></div>
        </div>
      )}
      <Card bodyClassName="p-0">
        {error && !data ? <div className="p-4"><ErrorBlock message={error} onRetry={reload} /></div>
          : !data ? <LoadingBlock />
          : data.items.length === 0 ? (
            <EmptyState icon={<Boxes className="h-6 w-6" />} title={q || category || stock ? 'No matching products' : 'No products yet'}
              text="Add the items you sell so FinWise can track stock and profit for you."
              action={manage && !q && <Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Add your first product</Button>} />
          ) : (
            <div className={`overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
              <table className="table-base">
                <thead><tr><th>Product</th><th className="hidden sm:table-cell">Category</th><th className="text-right">In stock</th>{manage && <th className="hidden text-right md:table-cell">Cost</th>}<th className="text-right">Price</th>{manage && <th className="w-24"></th>}</tr></thead>
                <tbody>
                  {data.items.map((p) => (
                    <tr key={p._id} className="hover:bg-slate-50/60">
                      <td>
                        <Link href={`/inventory/${p._id}`} className="font-medium text-slate-800 hover:text-brand-700">{p.name}</Link>
                        {p.sku && <div className="text-xs text-slate-400">{p.sku}</div>}
                      </td>
                      <td className="hidden text-slate-600 sm:table-cell">{p.category}</td>
                      <td className="text-right">
                        <span className="tabular font-medium">{formatNumber(p.quantity)}</span> <span className="text-xs text-slate-400">{p.unit}</span>
                        <div>{p.quantity <= 0 ? <Badge tone="red">Out</Badge> : p.quantity <= p.reorderLevel ? <Badge tone="amber">Low</Badge> : null}</div>
                      </td>
                      {manage && <td className="tabular hidden text-right text-slate-600 md:table-cell">{money(p.costPrice)}</td>}
                      <td className="tabular text-right font-medium">{money(p.sellingPrice)}</td>
                      {manage && (
                        <td className="text-right">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => setStockFor(p)} className="rounded p-1.5 text-brand-700 hover:bg-brand-50" title="Receive / adjust stock" aria-label="Stock"><PackagePlus className="h-4 w-4" /></button>
                            <button onClick={() => setEditing(p)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>
      <ProductModal open={!!editing} editing={editing === 'new' ? null : editing} categories={data?.categories ?? []} onClose={() => setEditing(null)} onSaved={reload} />
      <StockModal product={stockFor} onClose={() => setStockFor(null)} onSaved={reload} />
    </>
  );
}

export default function InventoryPage() {
  return <Suspense fallback={<LoadingBlock />}><InventoryInner /></Suspense>;
}
