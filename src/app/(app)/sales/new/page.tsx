'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CheckCircle2, Minus, Package, Plus, Search, ShoppingCart, Trash2, X } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { useApp } from '@/components/app-context';
import { Badge, Button, EmptyState, Field, Input, LoadingBlock, Modal, PageHeader, Select } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api } from '@/lib/client';
import { PAYMENT_METHODS, round2 } from '@/lib/money';
import { cn } from '@/lib/utils';

import type { Product } from '@/lib/types';
type CartLine = { product: Product; quantity: number; unitPrice: number };

export default function NewSalePage() {
  const { money, can } = useApp();
  const toast = useToast();
  const { data, loading, reload } = useApi<{ items: Product[]; categories: string[] }>('/api/products');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [customerName, setCustomerName] = useState('');
  const [saving, setSaving] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [done, setDone] = useState<{ _id: string; number: number; total: number } | null>(null);
  const canPrice = can('sales:void');

  const products = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.items ?? []).filter((p) => (!cat || p.category === cat) && (!s || p.name.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s)));
  }, [data, q, cat]);

  const inCart = (id: string) => cart.find((l) => l.product._id === id)?.quantity ?? 0;
  const add = (p: Product, n = 1) => {
    setCart((c) => {
      const ex = c.find((l) => l.product._id === p._id);
      const next = (ex?.quantity ?? 0) + n;
      if (next > p.quantity) { toast(`Only ${p.quantity} ${p.unit} of ${p.name} in stock`, 'error'); return c; }
      if (next <= 0) return c.filter((l) => l.product._id !== p._id);
      return ex ? c.map((l) => (l.product._id === p._id ? { ...l, quantity: round2(next) } : l)) : [...c, { product: p, quantity: n, unitPrice: p.sellingPrice }];
    });
  };
  const setQty = (id: string, v: number) => setCart((c) => c.map((l) => (l.product._id === id ? { ...l, quantity: Math.min(Math.max(v, 0), l.product.quantity) } : l)));
  const setPrice = (id: string, v: number) => setCart((c) => c.map((l) => (l.product._id === id ? { ...l, unitPrice: Math.max(v, 0) } : l)));

  const subtotal = round2(cart.reduce((s, l) => s + l.quantity * l.unitPrice, 0));
  const disc = Math.min(Number(discount) || 0, subtotal);
  const total = round2(subtotal - disc);
  const count = cart.reduce((s, l) => s + l.quantity, 0);

  const checkout = async () => {
    const lines = cart.filter((l) => l.quantity > 0);
    if (!lines.length) return;
    setSaving(true);
    try {
      const sale = await api<{ _id: string; number: number; total: number }>('/api/sales', {
        method: 'POST',
        json: { items: lines.map((l) => ({ productId: l.product._id, quantity: l.quantity, ...(canPrice ? { unitPrice: l.unitPrice } : {}) })), discount: disc, paymentMethod, customerName },
      });
      setDone(sale);
      setCart([]); setDiscount(''); setCustomerName(''); setCartOpen(false);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Sale failed', 'error');
      if (!navigator.onLine) toast('Sales need a connection so stock stays accurate. Record as income instead if urgent.', 'info');
    } finally {
      setSaving(false);
    }
  };

  const cartPanel = (
    <div className="flex h-full flex-col">
      {cart.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center text-sm text-slate-400">
          <ShoppingCart className="mb-2 h-8 w-8" /> Tap products to add them
        </div>
      ) : (
        <ul className="-mx-1 flex-1 space-y-2 overflow-y-auto px-1">
          {cart.map((l) => (
            <li key={l.product._id} className="rounded-lg border border-slate-200 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{l.product.name}</p>
                  {canPrice ? (
                    <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      @ <input type="number" step="0.01" min="0" value={l.unitPrice} onChange={(e) => setPrice(l.product._id, Number(e.target.value))} className="w-20 rounded border border-slate-200 px-1.5 py-0.5 text-xs" aria-label="Unit price" />
                    </div>
                  ) : <p className="text-xs text-slate-500">@ {money(l.unitPrice)}</p>}
                </div>
                <button onClick={() => setCart((c) => c.filter((x) => x.product._id !== l.product._id))} className="text-slate-300 hover:text-red-500" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button onClick={() => add(l.product, -1)} className="rounded-md border border-slate-200 p-1 hover:bg-slate-50" aria-label="Decrease"><Minus className="h-3.5 w-3.5" /></button>
                  <input type="number" value={l.quantity} min={0} step="any" onChange={(e) => setQty(l.product._id, Number(e.target.value))} className="tabular w-14 rounded-md border border-slate-200 py-0.5 text-center text-sm" aria-label="Quantity" />
                  <button onClick={() => add(l.product, 1)} className="rounded-md border border-slate-200 p-1 hover:bg-slate-50" aria-label="Increase"><Plus className="h-3.5 w-3.5" /></button>
                </div>
                <span className="tabular text-sm font-semibold">{money(l.quantity * l.unitPrice)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Payment">
            <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {PAYMENT_METHODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Select>
          </Field>
          <Field label="Discount"><Input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0.00" /></Field>
        </div>
        <Field label={paymentMethod === 'credit' ? 'Customer (required for credit)' : 'Customer (optional)'}>
          <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} maxLength={120} />
        </Field>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-slate-500"><span>Subtotal</span><span className="tabular">{money(subtotal)}</span></div>
          {disc > 0 && <div className="flex justify-between text-slate-500"><span>Discount</span><span className="tabular">−{money(disc)}</span></div>}
          <div className="flex justify-between text-lg font-semibold"><span>Total</span><span className="tabular">{money(total)}</span></div>
        </div>
        <Button size="lg" className="w-full" disabled={!cart.length || (paymentMethod === 'credit' && !customerName.trim())} loading={saving} onClick={checkout}>
          Complete sale · {money(total)}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <PageHeader title="New sale" subtitle="Stock and income update automatically." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="mb-3 flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input autoFocus placeholder="Search product or SKU" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
              {q && <button onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400" aria-label="Clear"><X className="h-4 w-4" /></button>}
            </div>
            {!!data?.categories.length && (
              <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-36" aria-label="Category">
                <option value="">All</option>
                {data.categories.map((c) => <option key={c}>{c}</option>)}
              </Select>
            )}
          </div>
          {loading && !data ? <LoadingBlock /> : !data?.items.length ? (
            <div className="card"><EmptyState icon={<Package className="h-6 w-6" />} title="No products yet" text="Add products to your inventory to start selling."
              action={can('inventory:manage') && <Link href="/inventory?new=1"><Button><Plus className="h-4 w-4" /> Add product</Button></Link>} /></div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {products.map((p) => {
                const n = inCart(p._id);
                const out = p.quantity <= 0;
                return (
                  <button key={p._id} disabled={out} onClick={() => add(p)}
                    className={cn('card relative flex flex-col items-start p-3 text-left transition hover:border-brand-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50', n > 0 && 'border-brand-500 ring-2 ring-brand-500/20')}>
                    {n > 0 && <span className="absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-700 px-1.5 text-xs font-bold text-white">{n}</span>}
                    <span className="line-clamp-2 pr-6 text-sm font-medium text-slate-800">{p.name}</span>
                    <span className="tabular mt-1 text-base font-semibold text-brand-800">{money(p.sellingPrice)}</span>
                    <span className="mt-1">{out ? <Badge tone="red">Out of stock</Badge> : p.quantity <= p.reorderLevel ? <Badge tone="amber">{p.quantity} left</Badge> : <span className="text-xs text-slate-500">{p.quantity} {p.unit}</span>}</span>
                  </button>
                );
              })}
              {products.length === 0 && <p className="col-span-full py-8 text-center text-sm text-slate-500">No products match “{q}”.</p>}
            </div>
          )}
        </div>
        <aside className="card sticky top-20 hidden h-[calc(100vh-7rem)] p-4 lg:block">{cartPanel}</aside>
      </div>

      {/* Mobile cart bar */}
      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-[68px] z-20 px-4 lg:hidden">
          <button onClick={() => setCartOpen(true)} className="flex w-full items-center justify-between rounded-xl bg-slate-900 px-4 py-3.5 text-white shadow-xl">
            <span className="flex items-center gap-2 text-sm"><ShoppingCart className="h-5 w-5" /> {count} item{count !== 1 ? 's' : ''}</span>
            <span className="tabular font-semibold">{money(total)} →</span>
          </button>
        </div>
      )}
      <Modal open={cartOpen} onClose={() => setCartOpen(false)} title="Cart">{cartPanel}</Modal>

      <Modal open={!!done} onClose={() => setDone(null)} title="Sale complete" size="sm">
        {done && (
          <div className="py-2 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <p className="mt-3 text-sm text-slate-500">Sale #{done.number}</p>
            <p className="tabular text-3xl font-bold">{money(done.total)}</p>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <Link href={`/sales/${done._id}`}><Button variant="outline" className="w-full">View receipt</Button></Link>
              <Button onClick={() => setDone(null)}>New sale</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
