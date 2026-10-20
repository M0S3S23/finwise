/**
 * End-to-end API smoke test. Run against a running server:
 *   BASE_URL=http://localhost:3000 node scripts/smoke-test.mjs
 * Creates a throwaway business and exercises the main flows + permission rules.
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗', msg); } };

function client() {
  let cookie = '';
  return async (path, { method = 'GET', body } = {}) => {
    const res = await fetch(BASE + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const ct = res.headers.get('content-type') ?? '';
    return { status: res.status, data: ct.includes('json') ? await res.json() : await res.text(), headers: res.headers };
  };
}

const id = Date.now().toString(36);
const owner = client();
console.log('Auth');
let r = await owner('/api/auth/signup', { method: 'POST', body: { businessName: `Smoke ${id}`, name: 'Owner Test', email: `owner-${id}@test.dev`, password: 'password123', currency: 'ZMW' } });
ok(r.status === 201, `signup → ${r.status}`);
r = await owner('/api/auth/signup', { method: 'POST', body: { businessName: 'Dup', name: 'Dup', email: `owner-${id}@test.dev`, password: 'password123', currency: 'ZMW' } });
ok(r.status === 409, `duplicate email rejected → ${r.status}`);
r = await client()('/api/dashboard');
ok(r.status === 401, `unauthenticated API → ${r.status}`);

console.log('Categories & transactions');
r = await owner('/api/categories');
const cats = r.data.items;
ok(cats.length >= 10, `default categories created (${cats.length})`);
const rent = cats.find((c) => c.name === 'Rent');
const services = cats.find((c) => c.name === 'Services');
r = await owner('/api/transactions', { method: 'POST', body: { type: 'expense', amount: 1500, categoryId: rent._id, description: 'Rent', paymentMethod: 'bank' } });
ok(r.status === 201 && r.data.categoryName === 'Rent', 'expense recorded');
const rentTx = r.data;
r = await owner('/api/transactions', { method: 'POST', body: { type: 'income', amount: 200, categoryId: rent._id } });
ok(r.status === 400, `category/type mismatch rejected → ${r.status}`);
r = await owner('/api/transactions', { method: 'POST', body: { type: 'income', amount: -5 } });
ok(r.status === 400, `negative amount rejected → ${r.status}`);
const cid = `offline-${id}`;
r = await owner('/api/transactions', { method: 'POST', body: { type: 'income', amount: 300, categoryId: services._id, clientId: cid } });
const r2 = await owner('/api/transactions', { method: 'POST', body: { type: 'income', amount: 300, categoryId: services._id, clientId: cid } });
ok(r.status === 201 && r2.status === 200 && r.data._id === r2.data._id, 'offline replay is idempotent (clientId)');
r = await owner(`/api/transactions/${rentTx._id}`, { method: 'PATCH', body: { amount: 1600 } });
ok(r.status === 200 && r.data.amount === 1600, 'transaction edited');

console.log('Inventory');
r = await owner('/api/products', { method: 'POST', body: { name: 'Sugar 2kg', sku: `SUG-${id}`, category: 'Groceries', unit: 'pack', costPrice: 40, sellingPrice: 55, quantity: 10, recordPurchase: true } });
ok(r.status === 201 && r.data.quantity === 10, 'product created with opening stock');
const sugar = r.data;
r = await owner(`/api/products/${sugar._id}/stock`, { method: 'POST', body: { type: 'restock', quantity: 10, unitCost: 50, recordExpense: true } });
ok(r.status === 200 && r.data.quantity === 20 && r.data.costPrice === 45, `restock + weighted avg cost (qty ${r.data.quantity}, cost ${r.data.costPrice})`);
r = await owner(`/api/products/${sugar._id}/stock`, { method: 'POST', body: { type: 'adjustment', quantity: -100 } });
ok(r.status === 400, `cannot adjust below zero → ${r.status}`);
r = await owner(`/api/products/${sugar._id}/stock`, { method: 'POST', body: { type: 'adjustment', quantity: -2, note: 'damaged' } });
ok(r.data.quantity === 18, 'write-off adjustment');

console.log('Sales');
r = await owner('/api/sales', { method: 'POST', body: { items: [{ productId: sugar._id, quantity: 4 }], discount: 10, paymentMethod: 'mobile_money', customerName: 'Mrs Phiri' } });
ok(r.status === 201 && r.data.total === 210 && r.data.number === 1, `sale created (total ${r.data.total})`);
const sale = r.data;
r = await owner(`/api/products/${sugar._id}`);
ok(r.data.product.quantity === 14, `stock decremented to ${r.data.product.quantity}`);
ok(r.data.movements.some((m) => m.type === 'sale'), 'stock movement logged');
r = await owner('/api/sales', { method: 'POST', body: { items: [{ productId: sugar._id, quantity: 999 }] } });
ok(r.status === 409, `overselling blocked → ${r.status}`);
r = await owner(`/api/transactions?type=income`);
ok(r.data.items.some((t) => t.saleId === sale._id && t.amount === 210), 'sale posted to ledger as income');
const saleTx = r.data.items.find((t) => t.saleId === sale._id);
r = await owner(`/api/transactions/${saleTx._id}`, { method: 'DELETE' });
ok(r.status === 400, 'sale-linked income cannot be deleted directly');

console.log('Reports');
r = await owner('/api/dashboard?period=month');
const s = r.data.summary;
ok(r.status === 200, 'dashboard loads');
// income 300 + 210 = 510; cogs 4×45 = 180; opex 1600 (rent); inventory purchases excluded from opex
ok(s.totalIncome === 510, `total income ${s.totalIncome}`);
ok(s.cogs === 180, `COGS ${s.cogs}`);
ok(s.operatingExpenses === 1600, `operating expenses ${s.operatingExpenses}`);
ok(s.netProfit === 510 - 180 - 1600, `net profit ${s.netProfit}`);
ok(s.totalExpenses === 1600 + 400 + 500, `cash expenses incl. stock purchases ${s.totalExpenses}`);
ok(r.data.topProducts[0]?.name === 'Sugar 2kg', 'top products');
r = await owner('/api/reports/export?kind=sales');
ok(r.status === 200 && String(r.data).includes('Mrs Phiri'), 'CSV export');

console.log('Void');
r = await owner(`/api/sales/${sale._id}`, { method: 'POST', body: { action: 'void', reason: 'Returned' } });
ok(r.status === 200 && r.data.status === 'voided', 'sale voided');
r = await owner(`/api/products/${sugar._id}`);
ok(r.data.product.quantity === 18, 'stock restored after void');
r = await owner('/api/dashboard?period=month');
ok(r.data.summary.totalIncome === 300, 'void removed income from ledger');

console.log('Team & permissions');
r = await owner('/api/team', { method: 'POST', body: { name: 'Staff Test', email: `staff-${id}@test.dev`, password: 'temp-pass-1', role: 'staff' } });
ok(r.status === 201, 'staff member added');
const staffId = r.data._id;
const staff = client();
r = await staff('/api/auth/login', { method: 'POST', body: { email: `staff-${id}@test.dev`, password: 'temp-pass-1' } });
ok(r.status === 200 && r.data.mustChangePassword === true, 'staff login, must change password');
ok((await staff('/api/dashboard')).status === 403, 'staff blocked from dashboard');
ok((await staff('/api/reports/summary')).status === 403, 'staff blocked from reports');
ok((await staff('/api/team')).status === 403, 'staff blocked from team');
ok((await staff(`/api/products/${sugar._id}/stock`, { method: 'POST', body: { type: 'restock', quantity: 5 } })).status === 403, 'staff blocked from stock changes');
r = await staff('/api/sales', { method: 'POST', body: { items: [{ productId: sugar._id, quantity: 1, unitPrice: 1 }] } });
ok(r.status === 201 && r.data.total === 55, 'staff can sell, but cannot override price');
ok((await staff(`/api/transactions/${rentTx._id}`, { method: 'DELETE' })).status === 403, 'staff cannot delete transactions');
r = await staff('/api/transactions');
ok(r.data.items.every((t) => t.userName === 'Staff Test'), 'staff only sees own transactions');
r = await staff('/api/account/password', { method: 'POST', body: { currentPassword: 'temp-pass-1', newPassword: 'new-pass-123' } });
ok(r.status === 200, 'staff changed password');
r = await owner(`/api/team/${staffId}`, { method: 'PATCH', body: { active: false } });
ok(r.status === 200, 'staff deactivated');
ok((await staff('/api/sales')).status === 401, 'deactivated staff session rejected');

console.log('Tenancy isolation');
const other = client();
await other('/api/auth/signup', { method: 'POST', body: { businessName: `Other ${id}`, name: 'Other', email: `other-${id}@test.dev`, password: 'password123', currency: 'USD' } });
ok((await other(`/api/products/${sugar._id}`)).status === 404, "other business can't read our product");
ok((await other(`/api/sales/${sale._id}`)).status === 404, "other business can't read our sale");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
