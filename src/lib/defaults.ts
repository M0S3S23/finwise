import type { ClientSession, Types } from 'mongoose';
import { Category } from '@/models/Category';

export const DEFAULT_CATEGORIES: { name: string; type: 'income' | 'expense'; color: string; system?: 'sales' | 'inventory' }[] = [
  { name: 'Sales', type: 'income', color: '#059669', system: 'sales' },
  { name: 'Services', type: 'income', color: '#0891b2' },
  { name: 'Other income', type: 'income', color: '#7c3aed' },
  { name: 'Inventory purchases', type: 'expense', color: '#d97706', system: 'inventory' },
  { name: 'Rent', type: 'expense', color: '#dc2626' },
  { name: 'Salaries & wages', type: 'expense', color: '#db2777' },
  { name: 'Utilities', type: 'expense', color: '#2563eb' },
  { name: 'Transport & fuel', type: 'expense', color: '#0d9488' },
  { name: 'Airtime & data', type: 'expense', color: '#9333ea' },
  { name: 'Marketing', type: 'expense', color: '#ea580c' },
  { name: 'Repairs & maintenance', type: 'expense', color: '#65a30d' },
  { name: 'Bank & mobile money charges', type: 'expense', color: '#475569' },
  { name: 'Licences & taxes', type: 'expense', color: '#b45309' },
  { name: 'Other expenses', type: 'expense', color: '#64748b' },
];

export async function createDefaultCategories(businessId: Types.ObjectId | string, session?: ClientSession | null) {
  await Category.insertMany(
    DEFAULT_CATEGORIES.map((c) => ({ ...c, system: c.system ?? null, businessId })),
    { session: session ?? undefined },
  );
}

/** Returns the system category (Sales / Inventory purchases), recreating it if missing. */
export async function getSystemCategory(businessId: string, system: 'sales' | 'inventory', session?: ClientSession | null) {
  const found = await Category.findOne({ businessId, system }).session(session ?? null);
  if (found) return found;
  const def = DEFAULT_CATEGORIES.find((c) => c.system === system)!;
  const [created] = await Category.create([{ ...def, businessId }], { session: session ?? undefined });
  return created;
}
