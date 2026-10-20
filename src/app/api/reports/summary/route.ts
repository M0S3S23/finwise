import { json, route, ApiError } from '@/lib/api';
import { fromDateInput, periodRange } from '@/lib/dates';
import { financialSummary, timeSeries, topProducts, inventorySnapshot } from '@/lib/services/reports';

export const GET = route('reports:view', async (req, { auth }) => {
  const u = new URL(req.url);
  const f = u.searchParams.get('from');
  const t = u.searchParams.get('to');
  const range = f && t ? { from: fromDateInput(f), to: fromDateInput(t, true) } : periodRange('month');
  if (range.from > range.to) throw new ApiError(400, 'Start date must be before end date');
  const [summary, series, products, inventory] = await Promise.all([
    financialSummary(auth.bid, range.from, range.to),
    timeSeries(auth.bid, range.from, range.to),
    topProducts(auth.bid, range.from, range.to, 20),
    inventorySnapshot(auth.bid),
  ]);
  return json({ summary, series, topProducts: products, inventory });
});

export const dynamic = 'force-dynamic';
