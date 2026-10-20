import { json, route } from '@/lib/api';
import { User } from '@/models/User';
import { Business } from '@/models/Business';

export const GET = route(null, async (_req, { auth }) => {
  const [user, business] = await Promise.all([
    User.findById(auth.uid).select('name email role mustChangePassword').lean(),
    Business.findById(auth.bid).lean(),
  ]);
  return json({ user: { id: auth.uid, ...user }, business });
});

export const dynamic = 'force-dynamic';
