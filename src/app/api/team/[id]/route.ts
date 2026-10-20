import bcrypt from 'bcryptjs';
import { json, parseBody, route, assertId, ApiError } from '@/lib/api';
import { teamUpdateSchema } from '@/lib/validators';
import { User } from '@/models/User';

type P = { id: string };

export const PATCH = route<P>('team:manage', async (req, { params, auth }) => {
  assertId(params.id);
  const data = await parseBody(req, teamUpdateSchema);
  const u = await User.findOne({ _id: params.id, businessId: auth.bid });
  if (!u) throw new ApiError(404, 'User not found');
  if (String(u._id) === auth.uid && (data.role === 'staff' || data.active === false)) {
    throw new ApiError(400, 'You cannot demote or deactivate your own account');
  }
  if (data.role) u.role = data.role;
  if (data.active !== undefined) u.active = data.active;
  if (data.resetPassword) {
    u.passwordHash = await bcrypt.hash(data.resetPassword, 12);
    u.mustChangePassword = true;
  }
  await u.save();
  return json({ _id: u._id, name: u.name, email: u.email, role: u.role, active: u.active });
});

export const DELETE = route<P>('team:manage', async (_req, { params, auth }) => {
  assertId(params.id);
  if (params.id === auth.uid) throw new ApiError(400, 'You cannot remove your own account');
  const u = await User.findOne({ _id: params.id, businessId: auth.bid });
  if (!u) throw new ApiError(404, 'User not found');
  // Keep the user record for audit history (sales / transactions reference it); just deactivate.
  u.active = false;
  await u.save();
  return json({ ok: true });
});
