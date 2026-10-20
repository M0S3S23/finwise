import { json, parseBody, route, ApiError } from '@/lib/api';
import { businessSchema } from '@/lib/validators';
import { Business } from '@/models/Business';

export const GET = route(null, async (_req, { auth }) => {
  const b = await Business.findById(auth.bid).lean();
  if (!b) throw new ApiError(404, 'Business not found');
  return json(b);
});

export const PATCH = route('business:manage', async (req, { auth }) => {
  const data = await parseBody(req, businessSchema);
  const b = await Business.findByIdAndUpdate(auth.bid, { $set: data }, { new: true, runValidators: true }).lean();
  return json(b);
});

export const dynamic = 'force-dynamic';
