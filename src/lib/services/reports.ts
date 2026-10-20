import { Types } from 'mongoose';
import { Transaction } from '@/models/Transaction';
import { Sale } from '@/models/Sale';
import { Product } from '@/models/Product';
import { Category } from '@/models/Category';
import { round2 } from '@/lib/money';

export type Bucket = 'day' | 'week' | 'month';

export function pickBucket(from: Date, to: Date): Bucket {
  const days = (to.getTime() - from.getTime()) / 864e5;
  if (days <= 45) return 'day';
  if (days <= 190) return 'week';
  return 'month';
}

function bucketKey(d: Date, b: Bucket) {
  const x = new Date(d);
  if (b === 'month') return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
  if (b === 'week') {
    const day = (x.getDay() + 6) % 7; // Monday start
    x.setDate(x.getDate() - day);
  }
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function bucketLabel(key: string, b: Bucket) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d || 1);
  if (b === 'month') return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function allBuckets(from: Date, to: Date, b: Bucket) {
  const keys: string[] = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  if (b === 'month') cur.setDate(1);
  if (b === 'week') cur.setDate(cur.getDate() - ((cur.getDay() + 6) % 7));
  while (cur <= to && keys.length < 400) {
    keys.push(bucketKey(cur, b));
    if (b === 'day') cur.setDate(cur.getDate() + 1);
    else if (b === 'week') cur.setDate(cur.getDate() + 7);
    else cur.setMonth(cur.getMonth() + 1);
  }
  return keys;
}

/**
 * Core financial summary for a date range.
 *
 * - Cash view: income − all expenses (what actually moved in/out).
 * - Profit view: income − cost of goods sold − operating expenses. Inventory purchases
 *   are excluded from operating expenses because their cost is recognised as COGS when sold.
 */
export async function financialSummary(businessId: string, from: Date, to: Date) {
  const bid = new Types.ObjectId(businessId);
  const match = { businessId: bid, date: { $gte: from, $lte: to } };

  // Lean projections aggregated in application code: portable across MongoDB-compatible backends
  // and fast at small-business volumes (thousands of records per period).
  const [txRows, saleRows, inventoryCats] = await Promise.all([
    Transaction.find(match).select('type categoryName amount').lean(),
    Sale.find({ ...match, status: 'completed' }).select('total costTotal discount').lean(),
    Category.find({ businessId: bid, system: 'inventory' }).select('name').lean(),
  ]);
  const groups = new Map<string, { _id: { type: string; categoryName: string }; total: number; count: number }>();
  for (const t of txRows) {
    const key = `${t.type}:${t.categoryName}`;
    const g = groups.get(key) ?? { _id: { type: t.type, categoryName: t.categoryName ?? 'Uncategorised' }, total: 0, count: 0 };
    g.total += t.amount;
    g.count++;
    groups.set(key, g);
  }
  const byCategory = [...groups.values()].sort((a, b) => b.total - a.total);
  const salesAgg = [saleRows.reduce((a, r) => ({ ...a, revenue: a.revenue + r.total, cost: a.cost + (r.costTotal ?? 0), discount: a.discount + (r.discount ?? 0), count: a.count + 1 }), { _id: null, revenue: 0, cost: 0, discount: 0, count: 0 })];

  const inventoryNames = new Set(inventoryCats.map((c) => c.name));
  const colors = new Map((await Category.find({ businessId: bid }).select('name type color').lean()).map((c) => [`${c.type}:${c.name}`, c.color]));

  const income = byCategory.filter((r) => r._id.type === 'income').map((r) => ({ name: r._id.categoryName, total: round2(r.total), count: r.count, color: colors.get(`income:${r._id.categoryName}`) ?? '#64748b' }));
  const expenses = byCategory.filter((r) => r._id.type === 'expense').map((r) => ({ name: r._id.categoryName, total: round2(r.total), count: r.count, color: colors.get(`expense:${r._id.categoryName}`) ?? '#64748b', inventory: inventoryNames.has(r._id.categoryName) }));

  const totalIncome = round2(income.reduce((s, r) => s + r.total, 0));
  const totalExpenses = round2(expenses.reduce((s, r) => s + r.total, 0));
  const inventoryPurchases = round2(expenses.filter((e) => e.inventory).reduce((s, r) => s + r.total, 0));
  const operatingExpenses = round2(totalExpenses - inventoryPurchases);
  const s = salesAgg[0] ?? { revenue: 0, cost: 0, discount: 0, count: 0 };
  const cogs = round2(s.cost);
  const grossProfit = round2(s.revenue - cogs);
  const netProfit = round2(totalIncome - cogs - operatingExpenses);

  return {
    range: { from, to },
    totalIncome, totalExpenses, netCashFlow: round2(totalIncome - totalExpenses),
    salesRevenue: round2(s.revenue), salesCount: s.count, discounts: round2(s.discount),
    cogs, grossProfit, grossMargin: s.revenue > 0 ? round2((grossProfit / s.revenue) * 100) : 0,
    operatingExpenses, inventoryPurchases, netProfit,
    netMargin: totalIncome > 0 ? round2((netProfit / totalIncome) * 100) : 0,
    income, expenses,
  };
}

export async function timeSeries(businessId: string, from: Date, to: Date, bucket = pickBucket(from, to)) {
  const rows = await Transaction.find({ businessId, date: { $gte: from, $lte: to } }).select('type amount date').lean();
  const keys = allBuckets(from, to, bucket);
  const map = new Map(keys.map((k) => [k, { income: 0, expense: 0 }]));
  for (const r of rows) {
    const k = bucketKey(r.date, bucket);
    const e = map.get(k) ?? { income: 0, expense: 0 };
    e[r.type as 'income' | 'expense'] += r.amount;
    map.set(k, e);
  }
  return {
    bucket,
    points: [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({
      key: k, label: bucketLabel(k, bucket), income: round2(v.income), expense: round2(v.expense), net: round2(v.income - v.expense),
    })),
  };
}

export async function topProducts(businessId: string, from: Date, to: Date, limit = 8) {
  // Aggregated in application code (projection keeps it light) so it runs on any MongoDB-compatible backend.
  const sales = await Sale.find({ businessId, status: 'completed', date: { $gte: from, $lte: to } }).select('items date').sort({ date: 1 }).lean();
  const map = new Map<string, { name: string; quantity: number; revenue: number; cost: number }>();
  for (const s of sales) {
    for (const it of s.items) {
      const k = String(it.productId);
      const e = map.get(k) ?? { name: it.name, quantity: 0, revenue: 0, cost: 0 };
      e.name = it.name;
      e.quantity += it.quantity;
      e.revenue += it.total;
      e.cost += (it.unitCost ?? 0) * it.quantity;
      map.set(k, e);
    }
  }
  return [...map.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, limit)
    .map(([productId, r]) => ({ productId, name: r.name, quantity: round2(r.quantity), revenue: round2(r.revenue), profit: round2(r.revenue - r.cost) }));
}

export async function inventorySnapshot(businessId: string) {
  const products = await Product.find({ businessId, archived: false }).select('name sku unit quantity reorderLevel costPrice sellingPrice category').sort({ name: 1 }).lean();
  let stockValue = 0, retailValue = 0;
  const low: typeof products = [];
  let outOfStock = 0;
  for (const p of products) {
    stockValue += Math.max(p.quantity, 0) * p.costPrice;
    retailValue += Math.max(p.quantity, 0) * p.sellingPrice;
    if (p.quantity <= 0) outOfStock++;
    if (p.quantity <= p.reorderLevel) low.push(p);
  }
  return {
    productCount: products.length,
    stockValue: round2(stockValue), retailValue: round2(retailValue), potentialProfit: round2(retailValue - stockValue),
    lowStockCount: low.length, outOfStock,
    lowStock: low.sort((a, b) => a.quantity - b.quantity).slice(0, 10).map((p) => ({ _id: String(p._id), name: p.name, quantity: p.quantity, unit: p.unit, reorderLevel: p.reorderLevel })),
  };
}
