'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Field, Input } from '@/components/ui';
import { api } from '@/lib/client';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const f = new FormData(e.currentTarget);
    try {
      const r = await api<{ redirect: string; mustChangePassword?: boolean }>('/api/auth/login', { method: 'POST', json: { email: f.get('email'), password: f.get('password') } });
      const next = params.get('next');
      router.replace(r.mustChangePassword ? '/settings?tab=account' : next && next.startsWith('/') && !next.startsWith('//') ? next : r.redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <Field label="Email"><Input name="email" type="email" autoComplete="email" required autoFocus /></Field>
      <Field label="Password"><Input name="password" type="password" autoComplete="current-password" required /></Field>
      <Button type="submit" className="w-full" size="lg" loading={loading}>Sign in</Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">Sign in to your FinWise account.</p>
      <Suspense><LoginForm /></Suspense>
      <p className="mt-6 text-center text-sm text-slate-500">
        New business? <Link href="/signup" className="font-medium text-brand-700 hover:underline">Create an account</Link>
      </p>
      <p className="mt-2 text-center text-xs text-slate-400">Staff: ask your business owner to add you.</p>
    </>
  );
}
