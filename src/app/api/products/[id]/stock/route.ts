import { json, parseBody, route, assertId } from '@/lib/api';
import { stockAdjustSchema } from '@/lib/validators';
import { adjustStock } from '@/lib/services/inventory';

export const POST = route<{ id: string }>('inventory:manage', async (req, { params, auth }) => {
  assertId(params.id);
  const data = await parseBody(req, stockAdjustSchema);
  const { product } = await adjustStock(auth, params.id, data);
  return json(product);
});
