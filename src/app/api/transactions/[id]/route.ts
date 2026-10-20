import { json, parseBody, route, assertId, ApiError } from '@/lib/api';
import { transactionUpdateSchema } from '@/lib/validators';
import { Transaction } from '@/models/Transaction';
import { Category } from '@/models/Category';

type P = { id: string };

export const PATCH = route<P>('transactions:edit', async (req, { params, auth }) => {
  assertId(params.id);
  const tx = await Transaction.findOne({ _id: params.id, businessId: auth.bid });
  if (!tx) throw new ApiError(404, 'Transaction not found');
  if (tx.source !== 'manual') throw new ApiError(400, `This entry was created by a ${tx.source}. Edit or void the ${tx.source} instead.`);
  const data = await parseBody(req, transactionUpdateSchema);
  const type = data.type ?? tx.type;
  if (data.categoryId) {
    const c = await Category.findOne({ _id: data.categoryId, businessId: auth.bid }).lean();
    if (!c) throw new ApiError(400, 'Category not found');
    if (c.type !== type) throw new ApiError(400, `"${c.name}" is an ${c.type} category`);
    tx.set({ categoryId: c._id, categoryName: c.name });
  }
  const { categoryId: _c, ...rest } = data;
  tx.set(rest);
  await tx.save();
  return json(tx);
});

export const DELETE = route<P>('transactions:edit', async (_req, { params, auth }) => {
  assertId(params.id);
  const tx = await Transaction.findOne({ _id: params.id, businessId: auth.bid });
  if (!tx) throw new ApiError(404, 'Transaction not found');
  if (tx.source === 'sale') throw new ApiError(400, 'This income comes from a sale. Void the sale instead.');
  await tx.deleteOne();
  return json({ ok: true });
});
