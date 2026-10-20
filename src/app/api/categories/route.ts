import { json, parseBody, route } from '@/lib/api';
import { categorySchema } from '@/lib/validators';
import { Category } from '@/models/Category';

export const GET = route('transactions:view', async (req, { auth }) => {
  const all = new URL(req.url).searchParams.get('all') === '1';
  const items = await Category.find({ businessId: auth.bid, ...(all ? {} : { archived: false }) }).sort({ type: 1, name: 1 }).lean();
  return json({ items });
});

export const POST = route('categories:manage', async (req, { auth }) => {
  const data = await parseBody(req, categorySchema);
  const c = await Category.create({ ...data, businessId: auth.bid });
  return json(c, 201);
});

export const dynamic = 'force-dynamic';
