/**
 * Seeds a demo business with ~90 days of realistic data.
 *   npm run seed            (uses MONGODB_URI from .env.local)
 *   npm run seed -- --reset (deletes the existing demo business first)
 *
 * Demo logins:
 *   Owner: demo@finwise.app  / Demo@1234
 *   Staff: staff@finwise.app / Staff@1234
 */
import { readFileSync, existsSync } from 'node:fs';
import mongoose, { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { Business } from '../src/models/Business';
import { User } from '../src/models/User';
import { Category } from '../src/models/Category';
import { Product } from '../src/models/Product';
import { Sale } from '../src/models/Sale';
import { StockMovement } from '../src/models/StockMovement';
import { Transaction } from '../src/models/Transaction';
import { DEFAULT_CATEGORIES } from '../src/lib/defaults';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const OWNER_EMAIL = 'demo@finwise.app';
const STAFF_EMAIL = 'staff@finwise.app';
const DAYS = 90;
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
const r2 = (n: number) => Math.round(n * 100) / 100;

const PRODUCTS = [
  ['Mealie meal 25kg', 'Groceries', 'bag', 210, 245, 'MM25'], ['Mealie meal 10kg', 'Groceries', 'bag', 90, 108, 'MM10'],
  ['Cooking oil 2L', 'Groceries', 'bottle', 78, 95, 'OIL2'], ['Sugar 2kg', 'Groceries', 'pack', 48, 58, 'SUG2'],
  ['Rice 5kg', 'Groceries', 'bag', 95, 118, 'RIC5'], ['Salt 1kg', 'Groceries', 'pack', 9, 13, 'SAL1'],
  ['Kapenta 1kg', 'Groceries', 'pack', 140, 175, 'KAP1'], ['Bread loaf', 'Bakery', 'pcs', 19, 24, 'BRD'],
  ['Coca-Cola 500ml', 'Beverages', 'bottle', 9, 13, 'COK5'], ['Mazoe orange 2L', 'Beverages', 'bottle', 52, 65, 'MAZ2'],
  ['Mosi lager 375ml', 'Beverages', 'bottle', 14, 19, 'MOS'], ['Water 750ml', 'Beverages', 'bottle', 4, 7, 'WAT'],
  ['Airtime voucher K20', 'Airtime', 'pcs', 19, 20, 'AIR20'], ['Bathing soap', 'Toiletries', 'pcs', 11, 16, 'SOAP'],
  ['Washing powder 1kg', 'Toiletries', 'pack', 38, 48, 'WASH'], ['Toothpaste 100ml', 'Toiletries', 'pcs', 17, 24, 'TPST'],
  ['Candles (6 pack)', 'Household', 'pack', 18, 25, 'CAND'], ['Matches (10 box)', 'Household', 'pack', 7, 10, 'MATC'],
  ['Paraffin 1L', 'Household', 'litre', 28, 35, 'PARA'], ['Exercise book 96pg', 'Stationery', 'pcs', 5, 8, 'BOOK'],
] as const;

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Set MONGODB_URI in .env.local');
  await mongoose.connect(uri);
  for (const m of [Business, User, Category, Product, Sale, StockMovement, Transaction]) {
    await m.syncIndexes().catch((e: Error) => console.warn(`[seed] index sync skipped for ${m.modelName}: ${e.message}`));
  }

  const existing = await User.findOne({ email: OWNER_EMAIL });
  if (existing) {
    if (!process.argv.includes('--reset')) { console.log('Demo data already exists. Re-run with --reset to recreate it.'); return; }
    const bid = existing.businessId;
    await Promise.all([Business, User, Category, Product, Sale, StockMovement, Transaction].map((m) =>
      m === Business ? Business.deleteOne({ _id: bid }) : (m as typeof User).deleteMany({ businessId: bid })));
    console.log('Removed existing demo business');
  }

  const biz = await Business.create({
    name: 'Mwila General Dealers', currency: 'ZMW', industry: 'Retail shop', phone: '+260 97 000 0000',
    address: 'Plot 12, Cha Cha Cha Road, Lusaka', receiptFooter: 'Thank you for shopping with us!', defaultReorderLevel: 8,
  });
  const bid = biz._id;
  const [owner, staff] = await User.create([
    { businessId: bid, name: 'Grace Mwila', email: OWNER_EMAIL, passwordHash: await bcrypt.hash('Demo@1234', 10), role: 'owner' },
    { businessId: bid, name: 'Joseph Banda', email: STAFF_EMAIL, passwordHash: await bcrypt.hash('Staff@1234', 10), role: 'staff' },
  ]);
  const cats = await Category.insertMany(DEFAULT_CATEGORIES.map((c) => ({ ...c, system: c.system ?? null, businessId: bid })));
  const cat = (name: string) => cats.find((c) => c.name === name)!;

  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - DAYS);
  const products = PRODUCTS.map(([name, category, unit, cost, price, sku]) => ({
    _id: new Types.ObjectId(), businessId: bid, name, category, unit, costPrice: cost, sellingPrice: price, sku,
    quantity: 0, reorderLevel: unit === 'bag' ? 5 : 10,
  }));
  const moves: Record<string, unknown>[] = [];
  const txs: Record<string, unknown>[] = [];
  const sales: Record<string, unknown>[] = [];

  const restock = (p: (typeof products)[number], qty: number, date: Date, initial = false) => {
    p.quantity += qty;
    moves.push({ businessId: bid, productId: p._id, type: initial ? 'initial' : 'restock', quantity: qty, balanceAfter: p.quantity, unitCost: p.costPrice, note: initial ? 'Opening stock' : 'Supplier delivery', userId: owner._id, date });
    if (!initial) txs.push({ businessId: bid, type: 'expense', amount: r2(qty * p.costPrice), categoryId: cat('Inventory purchases')._id, categoryName: 'Inventory purchases', description: `Stock purchase: ${qty} ${p.unit} × ${p.name}`, paymentMethod: pick(['cash', 'mobile_money', 'bank']), date, source: 'restock', productId: p._id, userId: owner._id, userName: owner.name });
  };
  for (const p of products) restock(p, Math.round(20 + rand() * 40), new Date(start), true);

  let saleNo = 0;
  for (let d = 0; d <= DAYS; d++) {
    const day = new Date(start); day.setDate(day.getDate() + d);
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    const n = Math.round((weekend ? 14 : 9) + rand() * 8 + d / 15);
    for (let s = 0; s < n; s++) {
      const date = new Date(day); date.setHours(7 + Math.floor(rand() * 13), Math.floor(rand() * 60));
      if (date > new Date()) continue;
      const lines = new Map<string, { p: (typeof products)[number]; q: number }>();
      const k = 1 + Math.floor(rand() * 3);
      for (let i = 0; i < k; i++) {
        const p = pick(products);
        if (p.quantity < 1) continue;
        const q = Math.min(p.quantity, 1 + Math.floor(rand() * (p.unit === 'bag' ? 2 : 4)));
        const ex = lines.get(String(p._id));
        if (ex) { if (ex.q + q <= p.quantity) ex.q += q; } else lines.set(String(p._id), { p, q });
      }
      if (!lines.size) continue;
      saleNo++;
      const saleId = new Types.ObjectId();
      const items = [...lines.values()].map(({ p, q }) => ({ productId: p._id, name: p.name, quantity: q, unitPrice: p.sellingPrice, unitCost: p.costPrice, total: r2(q * p.sellingPrice) }));
      const subtotal = r2(items.reduce((a, i) => a + i.total, 0));
      const discount = rand() < 0.05 ? r2(Math.min(subtotal * 0.05, 20)) : 0;
      const total = r2(subtotal - discount);
      const by = rand() < 0.65 ? staff : owner;
      const pm = pick(['cash', 'cash', 'cash', 'mobile_money', 'mobile_money', 'card']);
      const txId = new Types.ObjectId();
      for (const { p, q } of lines.values()) {
        p.quantity -= q;
        moves.push({ businessId: bid, productId: p._id, type: 'sale', quantity: -q, balanceAfter: p.quantity, unitCost: p.costPrice, saleId, note: `Sale #${saleNo}`, userId: by._id, date });
      }
      sales.push({ _id: saleId, businessId: bid, number: saleNo, items, subtotal, discount, total, costTotal: r2(items.reduce((a, i) => a + i.unitCost * i.quantity, 0)), paymentMethod: pm, status: 'completed', transactionId: txId, userId: by._id, userName: by.name, date });
      txs.push({ _id: txId, businessId: bid, type: 'income', amount: total, categoryId: cat('Sales')._id, categoryName: 'Sales', description: `Sale #${saleNo}: ${items.map((i) => `${i.quantity} × ${i.name}`).join(', ')}`.slice(0, 300), paymentMethod: pm, date, source: 'sale', saleId, userId: by._id, userName: by.name });
    }
    // Restock low items (supplier visits Mon & Thu), but leave a couple low for the demo
    if ((day.getDay() === 1 || day.getDay() === 4) && d < DAYS - 2) {
      for (const p of products) if (p.quantity <= p.reorderLevel + 3) restock(p, Math.round(25 + rand() * 30), new Date(day.getTime() + 8 * 3600e3));
    }
    const exp = (name: string, amount: number, description: string, pm = 'cash') =>
      txs.push({ businessId: bid, type: 'expense', amount, categoryId: cat(name)._id, categoryName: name, description, paymentMethod: pm, date: new Date(day.getTime() + 12 * 3600e3), source: 'manual', userId: owner._id, userName: owner.name });
    if (day.getDate() === 1) { exp('Rent', 3500, 'Shop rent', 'bank'); exp('Licences & taxes', 450, 'Council levy', 'mobile_money'); }
    if (day.getDate() === 28) exp('Salaries & wages', 2800, 'Shop assistant salary — Joseph', 'mobile_money');
    if (day.getDay() === 2) exp('Transport & fuel', r2(120 + rand() * 80), 'Fuel for deliveries');
    if (d % 10 === 3) exp('Utilities', r2(250 + rand() * 120), 'ZESCO electricity tokens', 'mobile_money');
    if (d % 7 === 5) exp('Airtime & data', 100, 'Business phone bundle', 'mobile_money');
    if (d % 15 === 8) exp('Bank & mobile money charges', r2(30 + rand() * 40), 'Transaction charges', 'mobile_money');
    if (d === 40) exp('Repairs & maintenance', 850, 'Fridge repair');
    if (d === 55) exp('Marketing', 400, 'Printed flyers & signboard');
    if (d % 20 === 11) txs.push({ businessId: bid, type: 'income', amount: r2(150 + rand() * 200), categoryId: cat('Services')._id, categoryName: 'Services', description: 'Phone charging & printing services', paymentMethod: 'cash', date: new Date(day.getTime() + 15 * 3600e3), source: 'manual', userId: owner._id, userName: owner.name });
  }
  // Leave two products low for the low-stock alert demo
  for (const p of products.slice(-2)) { const take = Math.max(0, p.quantity - 3); if (take) { p.quantity -= take; moves.push({ businessId: bid, productId: p._id, type: 'adjustment', quantity: -take, balanceAfter: p.quantity, unitCost: p.costPrice, note: 'Stock count correction', userId: owner._id, date: new Date() }); } }

  await Product.insertMany(products);
  await Sale.insertMany(sales);
  await Transaction.insertMany(txs);
  await StockMovement.insertMany(moves);
  await Business.updateOne({ _id: bid }, { saleSeq: saleNo });
  console.log(`Seeded "${biz.name}": ${products.length} products, ${sales.length} sales, ${txs.length} transactions, ${moves.length} stock movements.`);
  console.log(`Owner login: ${OWNER_EMAIL} / Demo@1234\nStaff login: ${STAFF_EMAIL} / Staff@1234`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => mongoose.disconnect());
