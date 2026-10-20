import { z } from 'zod';
import { json, parseBody, route, assertId, ApiError } from '@/lib/api';
import { Category } from '@/models/Category';
import { Transaction } from '@/models/Transaction';

type P = { id: string };
const updateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  archived: z.boolean().optional(),
});

export const PATCH = route<P>('categories:manage', async (req, { params, auth }) => {
  assertId(params.id);
  const data = await parseBody(req, updateSchema);
  const c = await Category.findOne({ _id: params.id, businessId: auth.bid });
  if (!c) throw new ApiError(404, 'Category not found');
  if (c.system && data.archived) throw new ApiError(400, 'System categories cannot be archived');
  const oldName = c.name;
  c.set(data);
  await c.save();
  if (data.name && data.name !== oldName) {
    await Transaction.updateMany({ businessId: auth.bid, categoryId: c._id }, { $set: { categoryName: c.name } });
  }
  return json(c);
});

export const DELETE = route<P>('categories:manage', async (_req, { params, auth }) => {
  assertId(params.id);
  const c = await Category.findOne({ _id: params.id, businessId: auth.bid });
  if (!c) throw new ApiError(404, 'Category not found');
  if (c.system) throw new ApiError(400, 'System categories cannot be deleted');
  const used = await Transaction.countDocuments({ businessId: auth.bid, categoryId: c._id });
  if (used > 0) {
    c.archived = true;
    await c.save();
    return json({ ok: true, archived: true, message: `Category is used by ${used} transaction(s), so it was archived instead of deleted.` });
  }
  await c.deleteOne();
  return json({ ok: true });
});
