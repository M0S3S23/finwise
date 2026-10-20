import { z } from 'zod';
import { json, parseBody, route, assertId, ApiError } from '@/lib/api';
import { Sale } from '@/models/Sale';
import { Business } from '@/models/Business';
import { voidSale } from '@/lib/services/sales';
import { can } from '@/lib/permissions';

type P = { id: string };

export const GET = route<P>('sales:view', async (_req, { params, auth }) => {
  assertId(params.id);
  const sale = await Sale.findOne({ _id: params.id, businessId: auth.bid }).lean();
  if (!sale) throw new ApiError(404, 'Sale not found');
  if (!can(auth.role, 'sales:void') && String(sale.userId) !== auth.uid) throw new ApiError(404, 'Sale not found');
  const business = await Business.findById(auth.bid).select('name phone address email taxNumber receiptFooter currency').lean();
  return json({ sale, business });
});

export const POST = route<P>('sales:void', async (req, { params, auth }) => {
  assertId(params.id);
  const { reason } = await parseBody(req, z.object({ action: z.literal('void'), reason: z.string().trim().max(300).optional() }));
  const sale = await voidSale(auth, params.id, reason);
  return json(sale);
});

export const dynamic = 'force-dynamic';
