import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { json, parseBody, publicRoute, ApiError } from '@/lib/api';
import { signupSchema } from '@/lib/validators';
import { withTransaction } from '@/lib/db';
import { Business } from '@/models/Business';
import { User } from '@/models/User';
import { createDefaultCategories } from '@/lib/defaults';
import { sessionCookie, signSession } from '@/lib/auth';

export const POST = publicRoute(async (req) => {
  const data = await parseBody(req, signupSchema);
  if (await User.exists({ email: data.email })) throw new ApiError(409, 'An account with this email already exists');
  const passwordHash = await bcrypt.hash(data.password, 12);

  const user = await withTransaction(async (session) => {
    const [biz] = await Business.create([{ name: data.businessName, currency: data.currency, industry: data.industry }], { session: session ?? undefined });
    await createDefaultCategories(biz._id, session);
    const [u] = await User.create([{ businessId: biz._id, name: data.name, email: data.email, passwordHash, role: 'owner', lastLoginAt: new Date() }], { session: session ?? undefined });
    return u;
  });

  const token = await signSession({ uid: String(user._id), bid: String(user.businessId), role: 'owner', name: user.name });
  cookies().set(sessionCookie(token));
  return json({ ok: true, redirect: '/dashboard' }, 201);
});
