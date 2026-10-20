'use client';
import { useEffect, useState } from 'react';
import { Button, Field, Input, Modal, Select } from './ui';
import { useToast } from './toast';
import { api, postOrQueue } from '@/lib/client';
import { PAYMENT_METHODS } from '@/lib/money';
import { toDateInput, fromDateInput } from '@/lib/dates';
import { cn } from '@/lib/utils';

export type Category = { _id: string; name: string; type: 'income' | 'expense'; color: string; system?: string | null; archived?: boolean };
export type Tx = {
  _id: string; type: 'income' | 'expense'; amount: number; categoryId?: string; categoryName: string; description?: string;
  paymentMethod: string; reference?: string; date: string; source: 'manual' | 'sale' | 'restock'; userName?: string; saleId?: string;
};

let categoryCache: Category[] | null = null;
export function useCategories() {
  const [cats, setCats] = useState<Category[]>(categoryCache ?? []);
  useEffect(() => {
    api<{ items: Category[] }>('/api/categories').then((r) => { categoryCache = r.items; setCats(r.items); }).catch(() => {});
  }, []);
  return cats;
}
export const invalidateCategories = () => { categoryCache = null; };

export function TransactionModal({ open, onClose, onSaved, initialType = 'expense', editing }: {
  open: boolean; onClose: () => void; onSaved: () => void; initialType?: 'income' | 'expense'; editing?: Tx | null;
}) {
  const toast = useToast();
  const cats = useCategories();
  const [type, setType] = useState<'income' | 'expense'>(initialType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setType(editing?.type ?? initialType); setError(''); }
  }, [open, editing, initialType]);

  const options = cats.filter((c) => c.type === type && !c.archived && c.system !== 'sales' && c.system !== 'inventory');
  const allForType = cats.filter((c) => c.type === type && !c.archived);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const body: Record<string, unknown> = {
      type, amount: Number(f.amount), categoryId: f.categoryId || undefined, description: f.description,
      paymentMethod: f.paymentMethod, reference: f.reference, date: fromDateInput(f.date).toISOString(),
    };
    // Keep current time-of-day when recording for today, so entries sort naturally.
    if (f.date === toDateInput(new Date())) body.date = new Date().toISOString();
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/transactions/${editing._id}`, { method: 'PATCH', json: body });
        toast('Transaction updated');
      } else {
        const r = await postOrQueue('/api/transactions', body, `${type === 'income' ? 'Income' : 'Expense'} ${body.amount}`);
        toast(r.queued ? 'Saved offline — will sync when you reconnect' : `${type === 'income' ? 'Income' : 'Expense'} recorded`, r.queued ? 'info' : 'success');
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit transaction' : 'Record transaction'}>
      <form id="tx-form" onSubmit={submit} className="space-y-4">
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
          {(['income', 'expense'] as const).map((t) => (
            <button type="button" key={t} onClick={() => setType(t)}
              className={cn('rounded-md py-2 text-sm font-medium transition', type === t ? (t === 'income' ? 'bg-white text-emerald-700 shadow-sm' : 'bg-white text-red-600 shadow-sm') : 'text-slate-500')}>
              {t === 'income' ? 'Money in' : 'Money out'}
            </button>
          ))}
        </div>
        <Field label="Amount">
          <Input name="amount" type="number" inputMode="decimal" step="0.01" min="0.01" required autoFocus defaultValue={editing?.amount ?? ''} className="text-lg font-semibold" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select name="categoryId" key={type} defaultValue={editing?.categoryId ?? ''}>
              <option value="">Uncategorised</option>
              {(editing ? allForType : options).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Date">
            <Input name="date" type="date" required defaultValue={toDateInput(editing?.date ?? new Date())} max={toDateInput(new Date())} />
          </Field>
        </div>
        <Field label="Description"><Input name="description" maxLength={300} placeholder={type === 'income' ? 'e.g. Delivery service for ABC Ltd' : 'e.g. ZESCO electricity tokens'} defaultValue={editing?.description ?? ''} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Paid via">
            <Select name="paymentMethod" defaultValue={editing?.paymentMethod ?? 'cash'}>
              {PAYMENT_METHODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Select>
          </Field>
          <Field label="Reference" hint="Receipt / txn no."><Input name="reference" maxLength={80} defaultValue={editing?.reference ?? ''} /></Field>
        </div>
      </form>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} type="button">Cancel</Button>
        <Button type="submit" form="tx-form" loading={saving}>{editing ? 'Save changes' : 'Save'}</Button>
      </div>
    </Modal>
  );
}
