import type { ClientSession } from 'mongoose';
import { Product } from '@/models/Product';
import { StockMovement } from '@/models/StockMovement';
import { Transaction } from '@/models/Transaction';
import { getSystemCategory } from '@/lib/defaults';
import { ApiError, type AuthContext } from '@/lib/api';
import { round2, type PaymentMethod } from '@/lib/money';
import { withTransaction } from '@/lib/db';

type AdjustInput = {
  type: 'restock' | 'adjustment' | 'initial';
  quantity: number;
  unitCost?: number;
  note?: string;
  recordExpense?: boolean;
  paymentMethod?: PaymentMethod;
};

/**
 * Changes a product's stock level and logs the movement.
 * Restocks update the weighted-average cost and (optionally) post an "Inventory purchases" expense.
 */
export async function adjustStock(auth: AuthContext, productId: string, input: AdjustInput, existingSession?: ClientSession | null) {
  const run = async (session: ClientSession | null) => {
    const product = await Product.findOne({ _id: productId, businessId: auth.bid }).session(session);
    if (!product) throw new ApiError(404, 'Product not found');

    const qty = input.type === 'restock' ? Math.abs(input.quantity) : input.quantity;
    const newQty = round2(product.quantity + qty);
    if (newQty < 0) throw new ApiError(400, `Only ${product.quantity} ${product.unit} in stock — cannot remove ${Math.abs(qty)}`);

    const unitCost = input.unitCost ?? product.costPrice;
    if (input.type === 'restock' && input.unitCost !== undefined) {
      const oldValue = Math.max(product.quantity, 0) * product.costPrice;
      const totalQty = Math.max(product.quantity, 0) + qty;
      product.costPrice = totalQty > 0 ? round2((oldValue + qty * unitCost) / totalQty) : unitCost;
    }
    product.quantity = newQty;
    await product.save({ session });

    await StockMovement.create([{
      businessId: auth.bid, productId: product._id, type: input.type, quantity: qty, balanceAfter: newQty,
      unitCost, note: input.note, userId: auth.uid, date: new Date(),
    }], { session: session ?? undefined });

    let transactionId: unknown = null;
    if ((input.type === 'restock' || input.type === 'initial') && input.recordExpense && qty > 0 && unitCost > 0) {
      const cat = await getSystemCategory(auth.bid, 'inventory', session);
      const [tx] = await Transaction.create([{
        businessId: auth.bid, type: 'expense', amount: round2(qty * unitCost), categoryId: cat._id, categoryName: cat.name,
        description: `Stock purchase: ${qty} ${product.unit} × ${product.name}`, paymentMethod: input.paymentMethod ?? 'cash',
        date: new Date(), source: 'restock', productId: product._id, userId: auth.uid, userName: auth.name,
      }], { session: session ?? undefined });
      transactionId = tx._id;
    }
    return { product, transactionId };
  };
  return existingSession !== undefined ? run(existingSession) : withTransaction(run);
}
