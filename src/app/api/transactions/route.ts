import { json, parseBody, route, escapeRegex, ApiError } from '@/lib/api';
import { transactionSchema } from '@/lib/validators';
import { Transaction } from '@/models/Transaction';
import { Category } from '@/models/Category';
import { can } from '@/lib/permissions';
import { fromDateInput } from '@/lib/dates';
import { Types } from 'mongoose';

const oid = (s: string) => new Types.ObjectId(s);

export const GET = route('transactions:view', async (req, { auth }) => {
  const u = new URL(req.url);
  const q: Record<string, unknown> = { businessId: oid(auth.bid) };
  const type = u.searchParams.get('type');
  if (type === 'income' || type === 'expense') q.type = type;
  const cat = u.searchParams.get('categoryId');
  if (cat && /^[a-f\d]{24}$/i.test(cat)) q.categoryId = oid(cat);
  const pm = u.searchParams.get('paymentMethod');
  if (pm) q.paymentMethod = pm;
  const from = u.searchParams.get('from');
  const to = u.searchParams.get('to');
  if (from || to) q.date = { ...(from ? { $gte: fromDateInput(from) } : {}), ...(to ? { $lte: fromDateInput(to, true) } : {}) };
  const search = u.searchParams.get('q')?.trim();
  if (search) q.$or = [{ description: { $regex: escapeRegex(search), $options: 'i' } }, { reference: { $regex: escapeRegex(search), $options: 'i' } }, { categoryName: { $regex: escapeRegex(search), $options: 'i' } }];
  // Staff only see entries they recorded
  if (!can(auth.role, 'transactions:edit')) q.userId = oid(auth.uid);

  const page = Math.max(1, Number(u.searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(u.searchParams.get('limit')) || 25));
  const [items, total, sums] = await Promise.all([
    Transaction.find(q).sort({ date: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Transaction.countDocuments(q),
    Transaction.aggregate([{ $match: q }, { $group: { _id: '$type', total: { $sum: '$amount' } } }]),
  ]);
  const income = sums.find((s) => s._id === 'income')?.total ?? 0;
  const expense = sums.find((s) => s._id === 'expense')?.total ?? 0;
  return json({ items, total, page, pages: Math.ceil(total / limit), totals: { income, expense, net: income - expense } });
});

export const POST = route('transactions:create', async (req, { auth }) => {
  const data = await parseBody(req, transactionSchema);
  // Idempotent replays from the offline outbox
  if (data.clientId) {
    const existing = await Transaction.findOne({ businessId: auth.bid, clientId: data.clientId }).lean();
    if (existing) return json(existing, 200);
  }
  let categoryName = 'Uncategorised';
  if (data.categoryId) {
    const c = await Category.findOne({ _id: data.categoryId, businessId: auth.bid }).lean();
    if (!c) throw new ApiError(400, 'Category not found');
    if (c.type !== data.type) throw new ApiError(400, `"${c.name}" is an ${c.type} category`);
    categoryName = c.name;
  }
  const tx = await Transaction.create({ ...data, businessId: auth.bid, categoryName, date: data.date ?? new Date(), source: 'manual', userId: auth.uid, userName: auth.name });
  return json(tx, 201);
});

export const dynamic = 'force-dynamic';
