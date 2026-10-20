import bcrypt from 'bcryptjs';
import { cookies, headers } from 'next/headers';
import { json, parseBody, publicRoute, ApiError } from '@/lib/api';
import { loginSchema } from '@/lib/validators';
import { User } from '@/models/User';
import { sessionCookie, signSession } from '@/lib/auth';

// Basic in-memory brute-force protection (per instance). Use a shared store (e.g. Redis) at scale.
const attempts = new Map<string, { count: number; until: number }>();
const MAX = 8;
const WINDOW = 15 * 60 * 1000;

export const POST = publicRoute(async (req) => {
  const { email, password } = await parseBody(req, loginSchema);
  const key = `${headers().get('x-forwarded-for')?.split(',')[0] ?? 'local'}:${email}`;
  const a = attempts.get(key);
  if (a && a.count >= MAX && a.until > Date.now()) throw new ApiError(429, 'Too many attempts. Try again in 15 minutes.');

  const user = await User.findOne({ email }).select('+passwordHash');
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!user || !ok) {
    const cur = a && a.until > Date.now() ? a : { count: 0, until: Date.now() + WINDOW };
    attempts.set(key, { count: cur.count + 1, until: cur.until });
    throw new ApiError(401, 'Incorrect email or password');
  }
  if (!user.active) throw new ApiError(403, 'Your account has been deactivated. Contact the business owner.');
  attempts.delete(key);
  user.lastLoginAt = new Date();
  await user.save();

  const token = await signSession({ uid: String(user._id), bid: String(user.businessId), role: user.role, name: user.name });
  cookies().set(sessionCookie(token));
  return json({ ok: true, role: user.role, mustChangePassword: user.mustChangePassword, redirect: user.role === 'owner' ? '/dashboard' : '/sales/new' });
});
