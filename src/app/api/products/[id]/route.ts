import { json, parseBody, route, assertId, ApiError } from '@/lib/api';
import { productUpdateSchema } from '@/lib/validators';
import { Product } from '@/models/Product';
import { StockMovement } from '@/models/StockMovement';
import { Sale } from '@/models/Sale';

type P = { id: string };

export const GET = route<P>('inventory:view', async (_req, { params, auth }) => {
  assertId(params.id);
  const product = await Product.findOne({ _id: params.id, businessId: auth.bid }).lean();
  if (!product) throw new ApiError(404, 'Product not found');
  const movements = await StockMovement.find({ businessId: auth.bid, productId: product._id }).sort({ date: -1 }).limit(100).populate('userId', 'name').lean();
  return json({ product, movements });
});

export const PATCH = route<P>('inventory:manage', async (req, { params, auth }) => {
  assertId(params.id);
  const data = await parseBody(req, productUpdateSchema);
  const p = await Product.findOneAndUpdate({ _id: params.id, businessId: auth.bid }, { $set: data }, { new: true, runValidators: true }).lean();
  if (!p) throw new ApiError(404, 'Product not found');
  return json(p);
});

export const DELETE = route<P>('inventory:manage', async (_req, { params, auth }) => {
  assertId(params.id);
  const p = await Product.findOne({ _id: params.id, businessId: auth.bid });
  if (!p) throw new ApiError(404, 'Product not found');
  const sold = await Sale.exists({ businessId: auth.bid, 'items.productId': p._id });
  if (sold) {
    p.archived = true;
    await p.save();
    return json({ ok: true, archived: true, message: 'Product has sales history, so it was archived instead of deleted.' });
  }
  await StockMovement.deleteMany({ businessId: auth.bid, productId: p._id });
  await p.deleteOne();
  return json({ ok: true });
});

export const dynamic = 'force-dynamic';
