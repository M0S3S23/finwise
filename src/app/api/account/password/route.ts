import bcrypt from 'bcryptjs';
import { json, parseBody, route, ApiError } from '@/lib/api';
import { passwordChangeSchema } from '@/lib/validators';
import { User } from '@/models/User';

export const POST = route(null, async (req, { auth }) => {
  const { currentPassword, newPassword } = await parseBody(req, passwordChangeSchema);
  const u = await User.findById(auth.uid).select('+passwordHash');
  if (!u) throw new ApiError(404, 'User not found');
  if (!(await bcrypt.compare(currentPassword, u.passwordHash))) throw new ApiError(400, 'Current password is incorrect');
  u.passwordHash = await bcrypt.hash(newPassword, 12);
  u.mustChangePassword = false;
  await u.save();
  return json({ ok: true });
});
