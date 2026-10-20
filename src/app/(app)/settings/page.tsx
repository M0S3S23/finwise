'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, Download, KeyRound, Smartphone, Tags, Trash2, UserPlus, Users } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { useApp } from '@/components/app-context';
import { Badge, Button, Card, Field, Input, LoadingBlock, Modal, PageHeader, Select, Textarea } from '@/components/ui';
import { useToast } from '@/components/toast';
import { invalidateCategories, type Category } from '@/components/transaction-form';
import { useConnectivity, useInstallPrompt } from '@/components/pwa';
import { api, downloadUrl } from '@/lib/client';
import { CURRENCIES } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'account', label: 'My account', icon: KeyRound, owner: false },
  { id: 'business', label: 'Business', icon: Building2, owner: true },
  { id: 'categories', label: 'Categories', icon: Tags, owner: true },
  { id: 'team', label: 'Team', icon: Users, owner: true },
  { id: 'app', label: 'App & data', icon: Smartphone, owner: false },
] as const;

function SettingsInner() {
  const { can, user } = useApp();
  const sp = useSearchParams();
  const router = useRouter();
  const tabs = TABS.filter((t) => !t.owner || can('business:manage'));
  const tab = tabs.find((t) => t.id === sp.get('tab'))?.id ?? 'account';
  return (
    <>
      <PageHeader title="Settings" />
      {user.mustChangePassword && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Please set a new password — your account was created with a temporary one.</div>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[200px_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => router.replace(`/settings?tab=${t.id}`)}
              className={cn('flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium', tab === t.id ? 'bg-white text-brand-800 shadow-card ring-1 ring-slate-200' : 'text-slate-600 hover:bg-white/60')}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </nav>
        <div>
          {tab === 'account' && <AccountTab />}
          {tab === 'business' && <BusinessTab />}
          {tab === 'categories' && <CategoriesTab />}
          {tab === 'team' && <TeamTab />}
          {tab === 'app' && <AppTab />}
        </div>
      </div>
    </>
  );
}

export default function SettingsPage() {
  return <Suspense fallback={<LoadingBlock />}><SettingsInner /></Suspense>;
}

function AccountTab() {
  const { user } = useApp();
  const toast = useToast();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setError('');
    if (f.newPassword !== f.confirm) return setError('New passwords do not match');
    setSaving(true);
    try {
      await api('/api/account/password', { method: 'POST', json: { currentPassword: f.currentPassword, newPassword: f.newPassword } });
      toast('Password changed');
      form.reset();
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setSaving(false); }
  };
  return (
    <div className="space-y-4">
      <Card title="Profile">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-slate-500">Name</dt><dd className="font-medium">{user.name}</dd></div>
          <div><dt className="text-slate-500">Email</dt><dd className="font-medium">{user.email}</dd></div>
          <div><dt className="text-slate-500">Role</dt><dd><Badge tone={user.role === 'owner' ? 'violet' : 'blue'}>{user.role}</Badge></dd></div>
        </dl>
      </Card>
      <Card title="Change password">
        <form onSubmit={submit} className="max-w-sm space-y-3">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <Field label="Current password"><Input name="currentPassword" type="password" required autoComplete="current-password" /></Field>
          <Field label="New password" hint="At least 8 characters"><Input name="newPassword" type="password" required minLength={8} autoComplete="new-password" /></Field>
          <Field label="Confirm new password"><Input name="confirm" type="password" required minLength={8} autoComplete="new-password" /></Field>
          <Button type="submit" loading={saving}>Update password</Button>
        </form>
      </Card>
    </div>
  );
}

type Biz = { name: string; currency: string; industry?: string; phone?: string; email?: string; address?: string; taxNumber?: string; receiptFooter?: string; defaultReorderLevel?: number };
function BusinessTab() {
  const toast = useToast();
  const router = useRouter();
  const { data } = useApi<Biz>('/api/business');
  const [saving, setSaving] = useState(false);
  if (!data) return <LoadingBlock />;
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (f.currency !== data.currency && !confirm('Changing currency only changes how amounts are displayed — existing amounts are NOT converted. Continue?')) return;
    setSaving(true);
    try {
      await api('/api/business', { method: 'PATCH', json: { ...f, defaultReorderLevel: Number(f.defaultReorderLevel || 0) } });
      toast('Business details saved');
      router.refresh();
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); }
    finally { setSaving(false); }
  };
  return (
    <Card title="Business details">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name"><Input name="name" required defaultValue={data.name} /></Field>
        <Field label="Currency">
          <Select name="currency" defaultValue={data.currency}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}</Select>
        </Field>
        <Field label="Phone"><Input name="phone" defaultValue={data.phone ?? ''} /></Field>
        <Field label="Email"><Input name="email" type="email" defaultValue={data.email ?? ''} /></Field>
        <Field label="Address" className="sm:col-span-2"><Input name="address" defaultValue={data.address ?? ''} /></Field>
        <Field label="Tax number (TPIN / VAT)"><Input name="taxNumber" defaultValue={data.taxNumber ?? ''} /></Field>
        <Field label="Default low-stock level"><Input name="defaultReorderLevel" type="number" min="0" defaultValue={data.defaultReorderLevel ?? 5} /></Field>
        <Field label="Receipt footer" className="sm:col-span-2" hint="Shown at the bottom of every receipt"><Textarea name="receiptFooter" maxLength={300} defaultValue={data.receiptFooter ?? ''} placeholder="Thank you for shopping with us! Goods once sold are not returnable." /></Field>
        <div className="sm:col-span-2"><Button type="submit" loading={saving}>Save changes</Button></div>
      </form>
    </Card>
  );
}

function CategoriesTab() {
  const toast = useToast();
  const { data, reload } = useApi<{ items: Category[] }>('/api/categories?all=1');
  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [color, setColor] = useState('#64748b');
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api('/api/categories', { method: 'POST', json: { name, type, color } }); setName(''); invalidateCategories(); reload(); toast('Category added'); }
    catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); }
  };
  const remove = async (c: Category) => {
    if (!confirm(`Remove "${c.name}"?`)) return;
    try { const r = await api<{ message?: string; archived?: boolean }>(`/api/categories/${c._id}`, { method: 'DELETE' }); invalidateCategories(); reload(); toast(r.message ?? 'Category removed', r.archived ? 'info' : 'success'); }
    catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); }
  };
  const restore = async (c: Category) => { await api(`/api/categories/${c._id}`, { method: 'PATCH', json: { archived: false } }); invalidateCategories(); reload(); };
  return (
    <div className="space-y-4">
      <Card title="Add category">
        <form onSubmit={add} className="flex flex-wrap items-end gap-2">
          <Field label="Name" className="min-w-[180px] flex-1"><Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} /></Field>
          <Field label="Type"><Select value={type} onChange={(e) => setType(e.target.value as 'income' | 'expense')}><option value="expense">Expense</option><option value="income">Income</option></Select></Field>
          <Field label="Colour"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-slate-300 bg-white p-1" /></Field>
          <Button type="submit">Add</Button>
        </form>
      </Card>
      {!data ? <LoadingBlock /> : (['income', 'expense'] as const).map((t) => (
        <Card key={t} title={t === 'income' ? 'Income categories' : 'Expense categories'} bodyClassName="p-0">
          <ul className="divide-y divide-slate-100">
            {data.items.filter((c) => c.type === t).map((c) => (
              <li key={c._id} className={cn('flex items-center gap-3 px-5 py-2.5 text-sm', c.archived && 'opacity-50')}>
                <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
                <span className="flex-1">{c.name}</span>
                {c.system && <Badge>Automatic</Badge>}
                {c.archived ? <button onClick={() => restore(c)} className="text-xs font-medium text-brand-700">Restore</button>
                  : !c.system && <button onClick={() => remove(c)} className="rounded p-1 text-slate-400 hover:text-red-600" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>}
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

type Member = { _id: string; name: string; email: string; role: 'owner' | 'staff'; active: boolean; lastLoginAt?: string; mustChangePassword?: boolean };
function TeamTab() {
  const { user } = useApp();
  const toast = useToast();
  const { data, reload } = useApi<{ items: Member[] }>('/api/team');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [pw, setPw] = useState('');
  useEffect(() => { if (open) setPw(Math.random().toString(36).slice(2, 6) + '-' + Math.random().toString(36).slice(2, 6) + Math.floor(Math.random() * 90 + 10)); }, [open]);

  const invite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setSaving(true);
    try { await api('/api/team', { method: 'POST', json: { ...f, password: pw } }); setOpen(false); setCreated({ email: f.email, password: pw }); reload(); }
    catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); }
    finally { setSaving(false); }
  };
  const update = async (m: Member, body: Record<string, unknown>, msg: string) => {
    try { await api(`/api/team/${m._id}`, { method: 'PATCH', json: body }); toast(msg); reload(); }
    catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); }
  };
  const resetPw = (m: Member) => {
    const p = Math.random().toString(36).slice(2, 10) + Math.floor(Math.random() * 90 + 10);
    if (!confirm(`Reset password for ${m.name}?`)) return;
    update(m, { resetPassword: p }, 'Password reset').then(() => setCreated({ email: m.email, password: p }));
  };

  return (
    <Card title="Team members" action={<Button size="sm" onClick={() => setOpen(true)}><UserPlus className="h-4 w-4" /> Add member</Button>} bodyClassName="p-0">
      <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-600">
        <strong>Owners</strong> see everything. <strong>Staff</strong> can make sales, record income/expenses and view stock — but can&apos;t see reports, profits, or change settings.
      </div>
      {!data ? <LoadingBlock /> : (
        <ul className="divide-y divide-slate-100">
          {data.items.map((m) => (
            <li key={m._id} className={cn('flex flex-wrap items-center gap-3 px-5 py-3', !m.active && 'opacity-60')}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{m.name} {m._id === user.id && <span className="text-xs text-slate-400">(you)</span>}</p>
                <p className="text-xs text-slate-500">{m.email} · {m.lastLoginAt ? `Last seen ${formatDate(m.lastLoginAt)}` : 'Never signed in'}</p>
              </div>
              {!m.active && <Badge tone="red">Deactivated</Badge>}
              {m._id !== user.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={m.role} onChange={(e) => update(m, { role: e.target.value }, 'Role updated')} className="h-8 w-auto py-1 text-xs" aria-label="Role">
                    <option value="staff">Staff</option><option value="owner">Owner</option>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => resetPw(m)}>Reset password</Button>
                  <Button size="sm" variant="outline" className={m.active ? 'text-red-600' : ''} onClick={() => update(m, { active: !m.active }, m.active ? 'Member deactivated' : 'Member reactivated')}>{m.active ? 'Deactivate' : 'Reactivate'}</Button>
                </div>
              ) : <Badge tone="violet">{m.role}</Badge>}
            </li>
          ))}
        </ul>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Add team member">
        <form id="invite" onSubmit={invite} className="space-y-3">
          <Field label="Full name"><Input name="name" required minLength={2} /></Field>
          <Field label="Email (used to sign in)"><Input name="email" type="email" required /></Field>
          <Field label="Role"><Select name="role" defaultValue="staff"><option value="staff">Staff — sales & recording only</option><option value="owner">Owner — full access</option></Select></Field>
          <Field label="Temporary password" hint="They'll be asked to change it on first sign-in"><Input value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} required /></Field>
        </form>
        <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" form="invite" loading={saving}>Add member</Button></div>
      </Modal>
      <Modal open={!!created} onClose={() => setCreated(null)} title="Share these sign-in details" size="sm">
        {created && (
          <div className="space-y-3 text-sm">
            <p className="text-slate-600">Send these to your team member. This password won&apos;t be shown again.</p>
            <div className="rounded-lg bg-slate-50 p-3 font-mono text-xs">
              <div>Link: {typeof window !== 'undefined' ? window.location.origin : ''}/login</div>
              <div>Email: {created.email}</div>
              <div>Password: {created.password}</div>
            </div>
            <Button className="w-full" onClick={() => { navigator.clipboard.writeText(`FinWise sign-in\n${window.location.origin}/login\nEmail: ${created.email}\nTemporary password: ${created.password}`); toast('Copied'); }}>Copy details</Button>
          </div>
        )}
      </Modal>
    </Card>
  );
}

function AppTab() {
  const { can } = useApp();
  const { available, install } = useInstallPrompt();
  const { online, pending } = useConnectivity();
  return (
    <div className="space-y-4">
      <Card title="Install FinWise">
        <p className="text-sm text-slate-600">Install FinWise on your phone or computer for an app-like experience — opens full screen, works offline, no app store needed.</p>
        {available ? <Button className="mt-3" onClick={install}><Download className="h-4 w-4" /> Install app</Button> : (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li><strong>Android (Chrome):</strong> menu ⋮ → <em>Install app</em> / <em>Add to Home screen</em></li>
            <li><strong>iPhone (Safari):</strong> Share button → <em>Add to Home Screen</em></li>
            <li><strong>Desktop (Chrome/Edge):</strong> install icon in the address bar</li>
          </ul>
        )}
      </Card>
      <Card title="Offline status">
        <p className="text-sm">Connection: {online ? <Badge tone="green">Online</Badge> : <Badge tone="amber">Offline</Badge>}</p>
        <p className="mt-2 text-sm text-slate-600">Entries waiting to sync: <strong>{pending}</strong></p>
        <p className="mt-2 text-xs text-slate-500">When offline you can keep recording income and expenses — they sync automatically when you reconnect. Sales need a connection so stock levels stay accurate across devices.</p>
      </Card>
      {can('reports:view') && (
        <Card title="Export your data">
          <p className="mb-3 text-sm text-slate-600">Download all your records as CSV files (opens in Excel or Google Sheets).</p>
          <div className="flex flex-wrap gap-2">
            {(['transactions', 'sales', 'inventory'] as const).map((k) => (
              <Button key={k} variant="outline" onClick={() => downloadUrl(`/api/reports/export?kind=${k}`)}><Download className="h-4 w-4" /> All {k}</Button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
