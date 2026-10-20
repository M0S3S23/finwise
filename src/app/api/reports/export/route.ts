import { route, ApiError } from '@/lib/api';
import { fromDateInput, toDateInput } from '@/lib/dates';
import { toCSV } from '@/lib/utils';
import { paymentLabel } from '@/lib/money';
import { Transaction } from '@/models/Transaction';
import { Sale } from '@/models/Sale';
import { Product } from '@/models/Product';

export const GET = route('reports:view', async (req, { auth }) => {
  const u = new URL(req.url);
  const kind = u.searchParams.get('kind') ?? 'transactions';
  const f = u.searchParams.get('from');
  const t = u.searchParams.get('to');
  const date = f && t ? { $gte: fromDateInput(f), $lte: fromDateInput(t, true) } : undefined;
  let csv: string;

  if (kind === 'transactions') {
    const rows = await Transaction.find({ businessId: auth.bid, ...(date ? { date } : {}) }).sort({ date: 1 }).lean();
    csv = toCSV(rows.map((r) => ({ ...r, date: toDateInput(r.date), paymentMethod: paymentLabel(r.paymentMethod), signed: r.type === 'income' ? r.amount : -r.amount })), [
      { key: 'date', label: 'Date' }, { key: 'type', label: 'Type' }, { key: 'categoryName', label: 'Category' },
      { key: 'description', label: 'Description' }, { key: 'amount', label: 'Amount' }, { key: 'signed', label: 'Signed amount' },
      { key: 'paymentMethod', label: 'Payment method' }, { key: 'reference', label: 'Reference' }, { key: 'source', label: 'Source' }, { key: 'userName', label: 'Recorded by' },
    ]);
  } else if (kind === 'sales') {
    const rows = await Sale.find({ businessId: auth.bid, ...(date ? { date } : {}) }).sort({ date: 1 }).lean();
    csv = toCSV(rows.map((r) => ({
      ...r, date: toDateInput(r.date), items: r.items.map((i) => `${i.quantity} x ${i.name} @ ${i.unitPrice}`).join('; '),
      profit: r.status === 'completed' ? Math.round((r.total - r.costTotal) * 100) / 100 : 0, paymentMethod: paymentLabel(r.paymentMethod),
    })), [
      { key: 'number', label: 'Sale #' }, { key: 'date', label: 'Date' }, { key: 'status', label: 'Status' }, { key: 'customerName', label: 'Customer' },
      { key: 'items', label: 'Items' }, { key: 'subtotal', label: 'Subtotal' }, { key: 'discount', label: 'Discount' }, { key: 'total', label: 'Total' },
      { key: 'costTotal', label: 'Cost of goods' }, { key: 'profit', label: 'Gross profit' }, { key: 'paymentMethod', label: 'Payment method' }, { key: 'userName', label: 'Sold by' },
    ]);
  } else if (kind === 'inventory') {
    const rows = await Product.find({ businessId: auth.bid, archived: false }).sort({ name: 1 }).lean();
    csv = toCSV(rows.map((r) => ({ ...r, stockValue: Math.round(r.quantity * r.costPrice * 100) / 100, status: r.quantity <= 0 ? 'Out of stock' : r.quantity <= r.reorderLevel ? 'Low' : 'OK' })), [
      { key: 'name', label: 'Product' }, { key: 'sku', label: 'SKU' }, { key: 'category', label: 'Category' }, { key: 'unit', label: 'Unit' },
      { key: 'quantity', label: 'Quantity' }, { key: 'reorderLevel', label: 'Reorder level' }, { key: 'costPrice', label: 'Cost price' },
      { key: 'sellingPrice', label: 'Selling price' }, { key: 'stockValue', label: 'Stock value (cost)' }, { key: 'status', label: 'Status' },
    ]);
  } else {
    throw new ApiError(400, 'Unknown export type');
  }

  const name = `finwise-${kind}-${f ?? 'all'}${t ? `-to-${t}` : ''}.csv`;
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"` } });
});

export const dynamic = 'force-dynamic';
