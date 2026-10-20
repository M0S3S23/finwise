import { Product } from '@/models/Product';
import { Sale } from '@/models/Sale';
import { StockMovement } from '@/models/StockMovement';
import { Transaction } from '@/models/Transaction';
import { Business } from '@/models/Business';
import { getSystemCategory } from '@/lib/defaults';
import { ApiError, type AuthContext } from '@/lib/api';
import { withTransaction } from '@/lib/db';
import { round2, type PaymentMethod } from '@/lib/money';

type SaleInput = {
  items: { productId: string; quantity: number; unitPrice?: number }[];
  discount: number;
  paymentMethod: PaymentMethod;
  customerName?: string;
  note?: string;
  date?: Date;
};

/**
 * Records a sale atomically: decrements stock (refusing to oversell), logs stock movements,
 * creates the Sale and posts the matching income transaction to the ledger.
 */
export async function createSale(auth: AuthContext, input: SaleInput) {
  // Merge duplicate lines for the same product
  const merged = new Map<string, { productId: string; quantity: number; unitPrice?: number }>();
  for (const it of input.items) {
    const ex = merged.get(it.productId);
    if (ex) ex.quantity += it.quantity;
    else merged.set(it.productId, { ...it });
  }
  const lines = [...merged.values()];

  return withTransaction(async (session) => {
    const opts = { session: session ?? undefined };
    const date = input.date ?? new Date();
    const products = await Product.find({ businessId: auth.bid, _id: { $in: lines.map((l) => l.productId) }, archived: false }).session(session);
    const byId = new Map(products.map((p) => [String(p._id), p]));

    const items = lines.map((l) => {
      const p = byId.get(l.productId);
      if (!p) throw new ApiError(400, 'One of the products no longer exists');
      const unitPrice = round2(l.unitPrice ?? p.sellingPrice);
      return { productId: p._id, name: p.name, quantity: l.quantity, unitPrice, unitCost: p.costPrice, total: round2(unitPrice * l.quantity), unit: p.unit };
    });

    // Decrement stock with a guard so concurrent sales can never push stock below zero.
    const balances = new Map<string, number>();
    for (const it of items) {
      const updated = await Product.findOneAndUpdate(
        { _id: it.productId, businessId: auth.bid, quantity: { $gte: it.quantity } },
        { $inc: { quantity: -it.quantity } },
        { new: true, session: session ?? undefined },
      );
      if (!updated) {
        const p = byId.get(String(it.productId))!;
        throw new ApiError(409, `Not enough stock for "${p.name}" — ${p.quantity} ${p.unit} available`);
      }
      balances.set(String(it.productId), updated.quantity);
    }

    const subtotal = round2(items.reduce((s, i) => s + i.total, 0));
    const discount = Math.min(round2(input.discount || 0), subtotal);
    const total = round2(subtotal - discount);
    const costTotal = round2(items.reduce((s, i) => s + i.unitCost * i.quantity, 0));

    const biz = await Business.findByIdAndUpdate(auth.bid, { $inc: { saleSeq: 1 } }, { new: true, session: session ?? undefined });
    if (!biz) throw new ApiError(404, 'Business not found');

    const [sale] = await Sale.create([{
      businessId: auth.bid, number: biz.saleSeq, items: items.map(({ unit: _u, ...i }) => i), subtotal, discount, total, costTotal,
      paymentMethod: input.paymentMethod, customerName: input.customerName, note: input.note,
      userId: auth.uid, userName: auth.name, date,
    }], opts);

    await StockMovement.insertMany(items.map((it) => ({
      businessId: auth.bid, productId: it.productId, type: 'sale', quantity: -it.quantity,
      balanceAfter: balances.get(String(it.productId)), unitCost: it.unitCost, saleId: sale._id,
      note: `Sale #${sale.number}`, userId: auth.uid, date,
    })), opts);

    if (total > 0) {
      const cat = await getSystemCategory(auth.bid, 'sales', session);
      const summary = items.map((i) => `${i.quantity} × ${i.name}`).join(', ');
      const [tx] = await Transaction.create([{
        businessId: auth.bid, type: 'income', amount: total, categoryId: cat._id, categoryName: cat.name,
        description: `Sale #${sale.number}: ${summary}`.slice(0, 300), paymentMethod: input.paymentMethod, date,
        source: 'sale', saleId: sale._id, userId: auth.uid, userName: auth.name,
      }], opts);
      sale.transactionId = tx._id;
      await sale.save({ session });
    }
    return sale;
  });
}

/** Voids a sale: returns items to stock and removes its income from the ledger. */
export async function voidSale(auth: AuthContext, saleId: string, reason?: string) {
  return withTransaction(async (session) => {
    const sale = await Sale.findOne({ _id: saleId, businessId: auth.bid }).session(session);
    if (!sale) throw new ApiError(404, 'Sale not found');
    if (sale.status === 'voided') throw new ApiError(400, 'This sale is already voided');

    for (const it of sale.items) {
      const p = await Product.findOneAndUpdate({ _id: it.productId, businessId: auth.bid }, { $inc: { quantity: it.quantity } }, { new: true, session: session ?? undefined });
      if (p) {
        await StockMovement.create([{
          businessId: auth.bid, productId: it.productId, type: 'void', quantity: it.quantity, balanceAfter: p.quantity,
          unitCost: it.unitCost, saleId: sale._id, note: `Voided sale #${sale.number}`, userId: auth.uid, date: new Date(),
        }], { session: session ?? undefined });
      }
    }
    await Transaction.deleteMany({ businessId: auth.bid, saleId: sale._id }).session(session);
    sale.status = 'voided';
    sale.voidReason = reason;
    await sale.save({ session });
    return sale;
  });
}
