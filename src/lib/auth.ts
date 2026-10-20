import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'fw_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type Role = 'owner' | 'staff';
export type SessionPayload = { uid: string; bid: string; role: Role; name: string };

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === 'production') throw new Error('AUTH_SECRET must be set (16+ chars)');
    return new TextEncoder().encode('finwise-dev-secret-do-not-use-in-production');
  }
  return new TextEncoder().encode(s);
}

export async function signSession(p: SessionPayload) {
  return new SignJWT(p)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret());
}

export async function verifySession(token?: string | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.uid || !payload.bid || !payload.role) return null;
    return { uid: String(payload.uid), bid: String(payload.bid), role: payload.role as Role, name: String(payload.name ?? '') };
  } catch {
    return null;
  }
}

export function sessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  };
}
