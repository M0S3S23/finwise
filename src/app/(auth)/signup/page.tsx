'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Field, Input, Select } from '@/components/ui';
import { api } from '@/lib/client';
import { CURRENCIES } from '@/lib/money';

const INDUSTRIES = ['Retail shop', 'Wholesale', 'Restaurant / food', 'Salon / beauty', 'Hardware', 'Pharmacy', 'Agriculture', 'Services', 'Manufacturing', 'Other'];

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (f.password !== f.confirm) return setError('Passwords do not match');
    setLoading(true);
    try {
      const r = await api<{ redirect: string }>('/api/auth/signup', { method: 'POST', json: f });
      router.replace(r.redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Create your business account</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">Free to start. Takes under a minute.</p>
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <Field label="Business name"><Input name="businessName" required minLength={2} placeholder="e.g. Mwila General Dealers" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Currency">
            <Select name="currency" defaultValue="ZMW" required>
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
            </Select>
          </Field>
          <Field label="Type of business">
            <Select name="industry" defaultValue="">
              <option value="">Select…</option>
              {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Your name"><Input name="name" required minLength={2} autoComplete="name" /></Field>
        <Field label="Email"><Input name="email" type="email" required autoComplete="email" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Password" hint="8+ characters"><Input name="password" type="password" required minLength={8} autoComplete="new-password" /></Field>
          <Field label="Confirm"><Input name="confirm" type="password" required minLength={8} autoComplete="new-password" /></Field>
        </div>
        <Button type="submit" className="w-full" size="lg" loading={loading}>Create account</Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account? <Link href="/login" className="font-medium text-brand-700 hover:underline">Sign in</Link>
      </p>
    </>
  );
}
