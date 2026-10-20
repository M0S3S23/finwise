'use client';
import { useEffect, useState } from 'react';
import { Button, Field, Input, Modal, Select, Textarea } from './ui';
import { useToast } from './toast';
import { useApp } from './app-context';
import { api } from '@/lib/client';
import { PAYMENT_METHODS } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { Product } from '@/lib/types';

export function ProductModal({ open, onClose, onSaved, editing, categories }: { open: boolean; onClose: () => void; onSaved: () => void; editing?: Product | null; categories: string[] }) {
  const toast = useToast();
  const { money } = useApp();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  useEffect(() => {
    if (open) { setError(''); setCost(String(editing?.costPrice ?? '')); setPrice(String(editing?.sellingPrice ?? '')); }
  }, [open, editing]);
  const margin = Number(price) > 0 && Number(cost) >= 0 ? ((Number(price) - Number(cost)) / Number(price)) * 100 : null;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const body: Record<string, unknown> = {
      name: f.name, sku: f.sku, category: f.category, unit: f.unit, costPrice: Number(f.costPrice || 0), sellingPrice: Number(f.sellingPrice),
      reorderLevel: f.reorderLevel === '' ? undefined : Number(f.reorderLevel), description: f.description,
    };
    if (!editing) { body.quantity = Number(f.quantity || 0); body.recordPurchase = f.recordPurchase === 'on'; }
    setSaving(true);
    try {
      if (editing) await api(`/api/products/${editing._id}`, { method: 'PATCH', json: body });
      else await api('/api/products', { method: 'POST', json: body });
      toast(editing ? 'Product updated' : 'Product added');
      onSaved(); onClose();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit product' : 'Add product'} size="lg">
      <form id="product-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</div>}
        <Field label="Product name" className="sm:col-span-2"><Input name="name" required maxLength={120} defaultValue={editing?.name} autoFocus /></Field>
        <Field label="Category">
          <Input name="category" list="product-cats" maxLength={60} defaultValue={editing?.category ?? ''} placeholder="e.g. Beverages" />
          <datalist id="product-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="SKU / code"><Input name="sku" maxLength={60} defaultValue={editing?.sku ?? ''} /></Field>
          <Field label="Unit">
            <Input name="unit" list="units" maxLength={20} defaultValue={editing?.unit ?? 'pcs'} />
            <datalist id="units">{['pcs', 'kg', 'g', 'litre', 'ml', 'box', 'pack', 'bag', 'crate', 'dozen', 'metre', 'pair'].map((u) => <option key={u} value={u} />)}</datalist>
          </Field>
        </div>
        <Field label="Cost price (what you pay)"><Input name="costPrice" type="number" step="0.01" min="0" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
        <Field label="Selling price" hint={margin !== null ? `Margin ${margin.toFixed(1)}% · ${money(Number(price) - Number(cost))} profit per unit` : undefined}>
          <Input name="sellingPrice" type="number" step="0.01" min="0" required value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        {!editing && <Field label="Opening stock"><Input name="quantity" type="number" step="any" min="0" defaultValue="0" /></Field>}
        <Field label="Low-stock alert at" hint="Leave blank to use business default"><Input name="reorderLevel" type="number" step="any" min="0" defaultValue={editing?.reorderLevel ?? ''} /></Field>
        {!editing && (
          <label className="flex items-start gap-2 text-sm text-slate-600 sm:col-span-2">
            <input type="checkbox" name="recordPurchase" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-700" />
            <span>Record opening stock as a purchase expense (only if you bought it during this accounting period)</span>
          </label>
        )}
        <Field label="Notes" className="sm:col-span-2"><Textarea name="description" maxLength={500} defaultValue={(editing as Product & { description?: string })?.description ?? ''} /></Field>
      </form>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" form="product-form" loading={saving}>{editing ? 'Save changes' : 'Add product'}</Button>
      </div>
    </Modal>
  );
}

export function StockModal({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { money } = useApp();
  const [mode, setMode] = useState<'restock' | 'adjustment'>('restock');
  const [qty, setQty] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [direction, setDirection] = useState<'remove' | 'add'>('remove');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (product) { setMode('restock'); setQty(''); setUnitCost(String(product.costPrice || '')); setError(''); setDirection('remove'); }
  }, [product]);
  if (!product) return null;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const n = Number(qty);
    setSaving(true); setError('');
    try {
      await api(`/api/products/${product._id}/stock`, {
        method: 'POST',
        json: mode === 'restock'
          ? { type: 'restock', quantity: n, unitCost: Number(unitCost || 0), note: f.note, recordExpense: f.recordExpense === 'on', paymentMethod: f.paymentMethod }
          : { type: 'adjustment', quantity: direction === 'remove' ? -n : n, note: f.note, recordExpense: false },
      });
      toast(mode === 'restock' ? `Added ${n} ${product.unit} to stock` : 'Stock adjusted');
      onSaved(); onClose();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={product.name}>
      <p className="mb-4 text-sm text-slate-500">Currently <strong className="text-slate-800">{product.quantity} {product.unit}</strong> in stock</p>
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
        {(['restock', 'adjustment'] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={cn('rounded-md py-2 text-sm font-medium', mode === m ? 'bg-white shadow-sm' : 'text-slate-500')}>
            {m === 'restock' ? 'Receive stock' : 'Adjust / write off'}
          </button>
        ))}
      </div>
      <form id="stock-form" onSubmit={submit} className="space-y-4">
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {mode === 'adjustment' && (
          <Field label="Change">
            <Select value={direction} onChange={(e) => setDirection(e.target.value as 'add' | 'remove')}>
              <option value="remove">Remove (damaged, expired, lost, own use)</option>
              <option value="add">Add (found, count correction)</option>
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Quantity (${product.unit})`}><Input type="number" step="any" min="0.01" required value={qty} onChange={(e) => setQty(e.target.value)} autoFocus /></Field>
          {mode === 'restock' && <Field label="Cost per unit"><Input type="number" step="0.01" min="0" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} /></Field>}
        </div>
        {mode === 'restock' && Number(qty) > 0 && Number(unitCost) > 0 && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm">Total cost: <strong className="tabular">{money(Number(qty) * Number(unitCost))}</strong></p>
        )}
        {mode === 'restock' && (
          <div className="grid grid-cols-2 items-end gap-3">
            <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
              <input type="checkbox" name="recordExpense" defaultChecked className="h-4 w-4 rounded border-slate-300" /> Record as expense
            </label>
            <Field label="Paid via">
              <Select name="paymentMethod" defaultValue="cash">{PAYMENT_METHODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</Select>
            </Field>
          </div>
        )}
        <Field label="Note"><Input name="note" maxLength={300} placeholder={mode === 'restock' ? 'Supplier, invoice no…' : 'Reason'} /></Field>
      </form>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" form="stock-form" loading={saving}>{mode === 'restock' ? 'Add to stock' : 'Save adjustment'}</Button>
      </div>
    </Modal>
  );
}
