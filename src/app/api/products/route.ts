import { json, parseBody, route, escapeRegex } from '@/lib/api';
import { productSchema } from '@/lib/validators';
import { Product } from '@/models/Product';
import { Business } from '@/models/Business';
import { withTransaction } from '@/lib/db';
import { adjustStock } from '@/lib/services/inventory';

export const GET = route('inventory:view', async (req, { auth }) => {
  const u = new URL(req.url);
  const q: Record<string, unknown> = { businessId: auth.bid, archived: u.searchParams.get('archived') === '1' };
  const search = u.searchParams.get('q')?.trim();
  if (search) q.$or = [{ name: { $regex: escapeRegex(search), $options: 'i' } }, { sku: { $regex: escapeRegex(search), $options: 'i' } }, { category: { $regex: escapeRegex(search), $options: 'i' } }];
  const category = u.searchParams.get('category');
  if (category) q.category = category;
  let items = await Product.find(q).sort({ name: 1 }).limit(1000).lean();
  const stock = u.searchParams.get('stock');
  if (stock === 'low') items = items.filter((p) => p.quantity <= p.reorderLevel);
  if (stock === 'out') items = items.filter((p) => p.quantity <= 0);
  const categories = await Product.distinct('category', { businessId: auth.bid, archived: false });
  return json({ items, categories: categories.filter(Boolean).sort() });
});

export const POST = route('inventory:manage', async (req, { auth }) => {
  const { quantity, recordPurchase, ...data } = await parseBody(req, productSchema);
  const biz = await Business.findById(auth.bid).select('defaultReorderLevel').lean();
  const product = await withTransaction(async (session) => {
    const [p] = await Product.create([{
      ...data, category: data.category || 'General', unit: data.unit || 'pcs',
      reorderLevel: data.reorderLevel ?? biz?.defaultReorderLevel ?? 5, quantity: 0, businessId: auth.bid,
    }], { session: session ?? undefined });
    if (quantity > 0) {
      await adjustStock(auth, String(p._id), { type: 'initial', quantity, unitCost: data.costPrice, note: 'Opening stock', recordExpense: !!recordPurchase }, session);
    }
    return p;
  });
  const fresh = await Product.findById(product._id).lean();
  return json(fresh, 201);
});

export const dynamic = 'force-dynamic';
