'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Ban, Printer, Share2 } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { useApp } from '@/components/app-context';
import { Badge, Button, ErrorBlock, Field, LoadingBlock, Modal, Textarea } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api } from '@/lib/client';
import { formatDate } from '@/lib/dates';
import { formatMoney, paymentLabel } from '@/lib/money';

type SaleDetail = {
  sale: { _id: string; number: number; date: string; items: { name: string; quantity: number; unitPrice: number; total: number; unitCost: number }[]; subtotal: number; discount: number; total: number; costTotal: number; paymentMethod: string; customerName?: string; note?: string; status: string; voidReason?: string; userName?: string };
  business: { name: string; phone?: string; address?: string; email?: string; taxNumber?: string; receiptFooter?: string; currency: string };
};

export default function SaleDetailPage({ params }: { params: { id: string } }) {
  const { can } = useApp();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<SaleDetail>(`/api/sales/${params.id}`);
  const [voidOpen, setVoidOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading && !data) return <LoadingBlock />;
  if (error || !data) return <ErrorBlock message={error ?? 'Not found'} onRetry={reload} />;
  const { sale, business } = data;
  const m = (n: number) => formatMoney(n, business.currency);

  const doVoid = async () => {
    setBusy(true);
    try {
      await api(`/api/sales/${sale._id}`, { method: 'POST', json: { action: 'void', reason } });
      toast('Sale voided — stock returned');
      setVoidOpen(false);
      reload();
    } catch (e) { toast(e instanceof Error ? e.message : 'Failed', 'error'); }
    finally { setBusy(false); }
  };

  const share = async () => {
    const text = `${business.name}\nReceipt #${sale.number} — ${formatDate(sale.date, true)}\n` +
      sale.items.map((i) => `${i.quantity} × ${i.name} = ${m(i.total)}`).join('\n') +
      (sale.discount ? `\nDiscount: −${m(sale.discount)}` : '') + `\nTOTAL: ${m(sale.total)}\nPaid: ${paymentLabel(sale.paymentMethod)}`;
    if (navigator.share) await navigator.share({ title: `Receipt #${sale.number}`, text }).catch(() => {});
    else { await navigator.clipboard.writeText(text); toast('Receipt copied to clipboard'); }
  };

  return (
    <div className="mx-auto max-w-lg">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/sales" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Sales</Link>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={share}><Share2 className="h-4 w-4" /> Share</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
          {can('sales:void') && sale.status === 'completed' && <Button variant="outline" size="sm" className="text-red-600" onClick={() => setVoidOpen(true)}><Ban className="h-4 w-4" /> Void</Button>}
        </div>
      </div>

      <div className="card p-6 sm:p-8">
        <div className="text-center">
          <h1 className="text-lg font-bold">{business.name}</h1>
          {business.address && <p className="text-xs text-slate-500">{business.address}</p>}
          <p className="text-xs text-slate-500">{[business.phone, business.email].filter(Boolean).join(' · ')}</p>
          {business.taxNumber && <p className="text-xs text-slate-500">TPIN/Tax no: {business.taxNumber}</p>}
        </div>
        <div className="my-5 flex items-center justify-between border-y border-dashed border-slate-300 py-3 text-sm">
          <div><p className="font-semibold">Receipt #{sale.number}</p><p className="text-xs text-slate-500">{formatDate(sale.date, true)}</p></div>
          {sale.status === 'voided' ? <Badge tone="red">VOIDED</Badge> : <Badge tone="green">Paid · {paymentLabel(sale.paymentMethod)}</Badge>}
        </div>
        {sale.customerName && <p className="mb-3 text-sm"><span className="text-slate-500">Customer:</span> {sale.customerName}</p>}
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="pb-2 font-medium">Item</th><th className="pb-2 text-right font-medium">Qty</th><th className="pb-2 text-right font-medium">Price</th><th className="pb-2 text-right font-medium">Total</th></tr></thead>
          <tbody>{sale.items.map((i, k) => (
            <tr key={k} className="border-t border-slate-100"><td className="py-2">{i.name}</td><td className="tabular py-2 text-right">{i.quantity}</td><td className="tabular py-2 text-right">{m(i.unitPrice)}</td><td className="tabular py-2 text-right font-medium">{m(i.total)}</td></tr>
          ))}</tbody>
        </table>
        <div className="mt-4 space-y-1 border-t border-dashed border-slate-300 pt-3 text-sm">
          <div className="flex justify-between text-slate-600"><span>Subtotal</span><span className="tabular">{m(sale.subtotal)}</span></div>
          {sale.discount > 0 && <div className="flex justify-between text-slate-600"><span>Discount</span><span className="tabular">−{m(sale.discount)}</span></div>}
          <div className="flex justify-between text-lg font-bold"><span>Total</span><span className="tabular">{m(sale.total)}</span></div>
        </div>
        {sale.status === 'voided' && sale.voidReason && <p className="mt-4 rounded bg-red-50 p-2 text-xs text-red-700">Void reason: {sale.voidReason}</p>}
        <p className="mt-6 text-center text-xs text-slate-500">{business.receiptFooter || 'Thank you for your business!'}</p>
        <p className="mt-1 text-center text-[10px] text-slate-400">Served by {sale.userName}</p>
        {can('sales:void') && sale.status === 'completed' && (
          <p className="no-print mt-4 rounded-lg bg-slate-50 p-2 text-center text-xs text-slate-500">Gross profit on this sale: <strong className="tabular">{m(sale.total - sale.costTotal)}</strong></p>
        )}
      </div>

      <Modal open={voidOpen} onClose={() => setVoidOpen(false)} title={`Void sale #${sale.number}?`} size="sm">
        <p className="text-sm text-slate-600">Items go back into stock and the income is removed from your records. This can&apos;t be undone.</p>
        <Field label="Reason" className="mt-4"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. Customer returned goods" /></Field>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setVoidOpen(false)}>Cancel</Button>
          <Button variant="danger" loading={busy} onClick={doVoid}>Void sale</Button>
        </div>
      </Modal>
    </div>
  );
}
