'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BarChart3, Boxes, ChevronDown, CloudOff, Download, LayoutDashboard, LogOut, Receipt, RefreshCw, Settings, ShoppingCart, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, outbox } from '@/lib/client';
import { useApp } from './app-context';
import { Logo } from './logo';
import { PWARegister, useConnectivity, useInstallPrompt } from './pwa';
import type { Permission } from '@/lib/permissions';

type NavItem = { href: string; label: string; short: string; icon: typeof Wallet; perm: Permission; match?: string };
const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', short: 'Home', icon: LayoutDashboard, perm: 'dashboard:view' },
  { href: '/sales/new', label: 'New sale', short: 'Sell', icon: ShoppingCart, perm: 'sales:create', match: '/sales/new' },
  { href: '/sales', label: 'Sales history', short: 'Sales', icon: Receipt, perm: 'sales:view' },
  { href: '/transactions', label: 'Income & expenses', short: 'Money', icon: Wallet, perm: 'transactions:view' },
  { href: '/inventory', label: 'Inventory', short: 'Stock', icon: Boxes, perm: 'inventory:view' },
  { href: '/reports', label: 'Reports', short: 'Reports', icon: BarChart3, perm: 'reports:view' },
  { href: '/settings', label: 'Settings', short: 'Settings', icon: Settings, perm: 'transactions:view' },
];

function isActive(pathname: string, item: NavItem) {
  if (item.match) return pathname.startsWith(item.match);
  if (item.href === '/sales') return pathname === '/sales' || (pathname.startsWith('/sales/') && !pathname.startsWith('/sales/new'));
  return pathname === item.href || pathname.startsWith(item.href + '/');
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, business, can } = useApp();
  const pathname = usePathname();
  const items = NAV.filter((n) => can(n.perm));
  const mobile = user.role === 'owner'
    ? items.filter((i) => ['/dashboard', '/transactions', '/sales/new', '/inventory', '/reports'].includes(i.href))
    : items.filter((i) => ['/sales/new', '/sales', '/transactions', '/inventory'].includes(i.href));

  return (
    <div className="min-h-screen lg:pl-64">
      <PWARegister />
      {/* Sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-100 px-5">
          <Logo />
          <div className="min-w-0">
            <div className="text-[15px] font-bold tracking-tight text-slate-900">FinWise</div>
            <div className="truncate text-xs text-slate-500">{business.name}</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {items.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link key={item.href} href={item.href}
                className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                  active ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')}>
                <item.icon className={cn('h-[18px] w-[18px]', active ? 'text-brand-700' : 'text-slate-400')} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <SidebarFooter />
      </aside>

      {/* Top bar */}
      <header className="no-print sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:h-16 lg:px-8">
        <div className="flex items-center gap-2 lg:hidden">
          <Logo className="h-7 w-7" />
          <span className="max-w-[45vw] truncate text-sm font-semibold">{business.name}</span>
        </div>
        <div className="hidden lg:block" />
        <div className="flex items-center gap-2">
          <SyncStatus />
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-7">{children}</main>

      {/* Bottom nav (mobile) */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-safe lg:hidden">
        <div className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${mobile.length}, minmax(0, 1fr))` }}>
          {mobile.map((item) => {
            const active = isActive(pathname, item);
            const sell = item.href === '/sales/new';
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium">
                <span className={cn('flex h-8 w-12 items-center justify-center rounded-full transition',
                  sell ? 'bg-brand-700 text-white shadow' : active ? 'bg-brand-50 text-brand-700' : 'text-slate-500')}>
                  <item.icon className="h-5 w-5" />
                </span>
                <span className={active ? 'text-brand-800' : 'text-slate-500'}>{item.short}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function SidebarFooter() {
  const { available, install } = useInstallPrompt();
  return (
    <div className="border-t border-slate-100 p-3">
      {available && (
        <button onClick={install} className="flex w-full items-center gap-3 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800 hover:bg-brand-100">
          <Download className="h-4 w-4" /> Install app
        </button>
      )}
      <p className="px-3 pt-2 text-[11px] text-slate-400">FinWise v1.0</p>
    </div>
  );
}

function SyncStatus() {
  const { online, pending } = useConnectivity();
  if (online && pending === 0) return null;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
      online ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-800')}>
      {online ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CloudOff className="h-3.5 w-3.5" />}
      {online ? `Syncing ${pending}` : `Offline${pending ? ` · ${pending} pending` : ''}`}
    </span>
  );
}

function UserMenu() {
  const { user } = useApp();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { available, install } = useInstallPrompt();
  useEffect(() => {
    const on = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', on);
    return () => document.removeEventListener('mousedown', on);
  }, []);

  const logout = async () => {
    const pending = (await outbox.all()).length;
    if (pending && !confirm(`${pending} offline entr${pending === 1 ? 'y has' : 'ies have'} not synced yet and will be lost. Sign out anyway?`)) return;
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    await outbox.clear();
    if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k);
    router.replace('/login');
    router.refresh();
  };

  const initials = user.name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-slate-100">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">{initials}</span>
        <span className="hidden text-sm font-medium sm:block">{user.name.split(' ')[0]}</span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          <div className="border-b border-slate-100 px-4 py-2.5">
            <div className="truncate text-sm font-medium">{user.name}</div>
            <div className="truncate text-xs text-slate-500">{user.email}</div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-brand-700">{user.role}</div>
          </div>
          <Link href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"><Settings className="h-4 w-4" /> Settings</Link>
          {available && <button onClick={install} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"><Download className="h-4 w-4" /> Install app</button>}
          <button onClick={logout} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"><LogOut className="h-4 w-4" /> Sign out</button>
        </div>
      )}
    </div>
  );
}
