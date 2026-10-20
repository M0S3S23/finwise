import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, verifySession } from './auth';

export async function getSession() {
  return verifySession(cookies().get(SESSION_COOKIE)?.value);
}

export async function requireSession() {
  const s = await getSession();
  if (!s) redirect('/login');
  return s;
}
