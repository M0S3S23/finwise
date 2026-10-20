import bcrypt from 'bcryptjs';
import { json, parseBody, route, ApiError } from '@/lib/api';
import { teamInviteSchema } from '@/lib/validators';
import { User } from '@/models/User';

export const GET = route('team:manage', async (_req, { auth }) => {
  const items = await User.find({ businessId: auth.bid }).select('name email role active lastLoginAt createdAt mustChangePassword').sort({ role: 1, name: 1 }).lean();
  return json({ items });
});

export const POST = route('team:manage', async (req, { auth }) => {
  const data = await parseBody(req, teamInviteSchema);
  if (await User.exists({ email: data.email })) throw new ApiError(409, 'A user with this email already exists');
  const u = await User.create({
    businessId: auth.bid, name: data.name, email: data.email, role: data.role,
    passwordHash: await bcrypt.hash(data.password, 12), mustChangePassword: true,
  });
  return json({ _id: u._id, name: u.name, email: u.email, role: u.role, active: u.active }, 201);
});

export const dynamic = 'force-dynamic';
