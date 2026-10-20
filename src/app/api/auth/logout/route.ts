import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';

export async function POST() {
  cookies().delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}

/** GET variant used for forced sign-out (e.g. deactivated account) — clears the cookie and redirects. */
export async function GET(req: Request) {
  cookies().delete(SESSION_COOKIE);
  return NextResponse.redirect(new URL('/login', req.url));
}
