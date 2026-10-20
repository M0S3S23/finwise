import { z } from 'zod';
import { CURRENCY_CODES, PAYMENT_METHOD_VALUES } from './money';

const money = z.coerce.number().finite().min(0).max(1e12);
const optStr = (max: number) => z.string().trim().max(max).optional().or(z.literal('').transform(() => undefined));
const dateish = z.coerce.date();
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const signupSchema = z.object({
  businessName: z.string().trim().min(2, 'Business name is too short').max(120),
  name: z.string().trim().min(2, 'Name is too short').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  currency: z.enum(CURRENCY_CODES),
  industry: optStr(80),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

export const transactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: money.refine((n) => n > 0, 'Amount must be greater than 0'),
  categoryId: objectId.optional(),
  description: optStr(300),
  paymentMethod: z.enum(PAYMENT_METHOD_VALUES).default('cash'),
  reference: optStr(80),
  date: dateish.optional(),
  clientId: z.string().max(64).optional(),
});
export const transactionUpdateSchema = transactionSchema.partial().omit({ clientId: true });

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(60),
  type: z.enum(['income', 'expense']),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).default('#64748b'),
});

export const productSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  sku: optStr(60),
  category: optStr(60),
  unit: optStr(20),
  costPrice: money.default(0),
  sellingPrice: money,
  quantity: z.coerce.number().finite().min(0).max(1e9).default(0),
  reorderLevel: z.coerce.number().finite().min(0).max(1e9).optional(),
  description: optStr(500),
  recordPurchase: z.boolean().optional(),
});
export const productUpdateSchema = productSchema.omit({ quantity: true, recordPurchase: true }).partial().extend({ archived: z.boolean().optional() });

export const stockAdjustSchema = z.object({
  type: z.enum(['restock', 'adjustment']),
  /** restock: positive quantity received. adjustment: signed change (e.g. -2 damaged). */
  quantity: z.coerce.number().finite().refine((n) => n !== 0, 'Quantity cannot be 0'),
  unitCost: money.optional(),
  note: optStr(300),
  recordExpense: z.boolean().default(true),
  paymentMethod: z.enum(PAYMENT_METHOD_VALUES).default('cash'),
});

export const saleSchema = z.object({
  items: z.array(z.object({
    productId: objectId,
    quantity: z.coerce.number().finite().positive().max(1e7),
    unitPrice: money.optional(),
  })).min(1, 'Add at least one item').max(200),
  discount: money.default(0),
  paymentMethod: z.enum(PAYMENT_METHOD_VALUES).default('cash'),
  customerName: optStr(120),
  note: optStr(300),
  date: dateish.optional(),
});

export const businessSchema = z.object({
  name: z.string().trim().min(2).max(120),
  currency: z.enum(CURRENCY_CODES),
  industry: optStr(80),
  phone: optStr(40),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal('').transform(() => undefined)),
  address: optStr(300),
  taxNumber: optStr(60),
  receiptFooter: optStr(300),
  defaultReorderLevel: z.coerce.number().min(0).max(1e6).optional(),
}).partial();

export const teamInviteSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
  role: z.enum(['owner', 'staff']).default('staff'),
});
export const teamUpdateSchema = z.object({
  role: z.enum(['owner', 'staff']).optional(),
  active: z.boolean().optional(),
  resetPassword: z.string().min(8).max(128).optional(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
});
