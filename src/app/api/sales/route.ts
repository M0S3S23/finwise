import { Types } from 'mongoose';
import { json, parseBody, route } from '@/lib/api';
import { saleSchema } from '@/lib/validators';
import { Sale } from '@/models/Sale';
import { createSale } from '@/lib/services/sales';
import { can } from '@/lib/permissions';
import { fromDateInput } from '@/lib/dates';

export const GET = route('sales:view', async (req, { auth }) => {
  const u = new URL(req.url);
  const q: Record<string, unknown> = { businessId: new Types.ObjectId(auth.bid) };
  const from = u.searchParams.get('from');
  const to = u.searchParams.get('to');
  if (from || to) q.date = { ...(from ? { $gte: fromDateInput(from) } : {}), ...(to ? { $lte: fromDateInput(to, true) } : {}) };
  const status = u.searchParams.get('status');
  if (status === 'completed' || status === 'voided') q.status = status;
  const num = Number(u.searchParams.get('q'));
  if (num) q.number = num;
  if (!can(auth.role, 'sales:void')) q.userId = new Types.ObjectId(auth.uid);

  const page = Math.max(1, Number(u.searchParams.get('page')) || 1);
  const limit = Math.min(100, Number(u.searchParams.get('limit')) || 25);
  const [items, total, agg, completed] = await Promise.all([
    Sale.find(q).sort({ date: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Sale.countDocuments(q),
    Sale.aggregate([{ $match: { ...q, status: 'completed' } }, { $group: { _id: null, revenue: { $sum: '$total' } } }]),
    Sale.countDocuments({ ...q, status: 'completed' }),
  ]);
  return json({ items, total, page, pages: Math.ceil(total / limit), summary: { revenue: agg[0]?.revenue ?? 0, count: completed } });
});

export const POST = route('sales:create', async (req, { auth }) => {
  const data = await parseBody(req, saleSchema);
  // Only owners may override prices or back-date sales
  if (!can(auth.role, 'sales:void')) {
    data.items = data.items.map(({ unitPrice: _p, ...i }) => i);
    delete data.date;
  }
  const sale = await createSale(auth, data);
  return json(sale, 201);
});

export const dynamic = 'force-dynamic';
