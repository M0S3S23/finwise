import type { Role } from './auth';

export const PERMISSIONS = {
  'dashboard:view': ['owner'],
  'reports:view': ['owner'],
  'transactions:view': ['owner', 'staff'],
  'transactions:create': ['owner', 'staff'],
  'transactions:edit': ['owner'],
  'sales:create': ['owner', 'staff'],
  'sales:view': ['owner', 'staff'],
  'sales:void': ['owner'],
  'inventory:view': ['owner', 'staff'],
  'inventory:manage': ['owner'],
  'categories:manage': ['owner'],
  'business:manage': ['owner'],
  'team:manage': ['owner'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined | null, perm: Permission) {
  return !!role && (PERMISSIONS[perm] as readonly Role[]).includes(role);
}
