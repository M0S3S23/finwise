import { json, route } from '@/lib/api';
import { periodRange, fromDateInput, type Period } from '@/lib/dates';
import { financialSummary, timeSeries, topProducts, inventorySnapshot } from '@/lib/services/reports';
import { Transaction } from '@/models/Transaction';

export const GET = route('dashboard:view', async (req, { auth }) => {
  const u = new URL(req.url);
  const period = (u.searchParams.get('period') ?? 'month') as Period;
  const range = u.searchParams.get('from') && u.searchParams.get('to')
    ? { from: fromDateInput(u.searchParams.get('from')!), to: fromDateInput(u.searchParams.get('to')!, true) }
    : periodRange(period);

  // Previous equivalent period, for trend comparison
  const span = range.to.getTime() - range.from.getTime();
  const prev = { from: new Date(range.from.getTime() - span - 1), to: new Date(range.from.getTime() - 1) };

  const [summary, previous, series, products, inventory, recent] = await Promise.all([
    financialSummary(auth.bid, range.from, range.to),
    financialSummary(auth.bid, prev.from, prev.to),
    timeSeries(auth.bid, range.from, range.to),
    topProducts(auth.bid, range.from, range.to, 6),
    inventorySnapshot(auth.bid),
    Transaction.find({ businessId: auth.bid }).sort({ date: -1, createdAt: -1 }).limit(8).lean(),
  ]);

  return json({
    range, summary, series, topProducts: products, inventory, recent,
    previous: { totalIncome: previous.totalIncome, totalExpenses: previous.totalExpenses, netProfit: previous.netProfit, salesRevenue: previous.salesRevenue },
  });
});

export const dynamic = 'force-dynamic';
