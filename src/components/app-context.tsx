'use client';
import { createContext, useContext, type ReactNode } from 'react';
import type { Role } from '@/lib/auth';
import { can as canFn, type Permission } from '@/lib/permissions';
import { formatMoney } from '@/lib/money';

export type AppUser = { id: string; name: string; email: string; role: Role; mustChangePassword?: boolean };
export type AppBusiness = { id: string; name: string; currency: string };
type Ctx = { user: AppUser; business: AppBusiness; can: (p: Permission) => boolean; money: (n: number, compact?: boolean) => string };

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ user, business, children }: { user: AppUser; business: AppBusiness; children: ReactNode }) {
  const value: Ctx = {
    user, business,
    can: (p) => canFn(user.role, p),
    money: (n, compact) => formatMoney(n, business.currency, { compact }),
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp must be used inside AppProvider');
  return c;
}
