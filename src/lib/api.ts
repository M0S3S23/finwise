import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ZodError, type ZodTypeAny, type infer as ZodInfer } from 'zod';
import { connectDB } from './db';
import { SESSION_COOKIE, verifySession, type SessionPayload } from './auth';
import { can, type Permission } from './permissions';
import { User } from '@/models/User';

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export function json<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === 'number' ? { status: init } : init);
}

export type AuthContext = SessionPayload;

type Handler<P> = (req: Request, ctx: { params: P; auth: AuthContext }) => Promise<Response>;

/** Wraps a route handler with DB connection, session + active-user check, permission check and error handling. */
export function route<P = Record<string, string>>(perm: Permission | null, handler: Handler<P>) {
  return async (req: Request, ctx: { params: P }) => {
    try {
      await connectDB();
      const session = await verifySession(cookies().get(SESSION_COOKIE)?.value);
      if (!session) throw new ApiError(401, 'Please sign in');
      const user = await User.findById(session.uid).select('active role businessId name').lean();
      if (!user || !user.active) throw new ApiError(401, 'Your account is inactive');
      const auth: AuthContext = { uid: session.uid, bid: String(user.businessId), role: user.role, name: user.name };
      if (perm && !can(auth.role, perm)) throw new ApiError(403, 'You do not have permission to do this');
      return await handler(req, { params: ctx.params, auth });
    } catch (e) {
      return handleError(e);
    }
  };
}

/** Public (no-auth) handler wrapper. */
export function publicRoute(handler: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try {
      await connectDB();
      return await handler(req);
    } catch (e) {
      return handleError(e);
    }
  };
}

export function handleError(e: unknown) {
  // Let Next.js internal control-flow errors (dynamic usage, redirects) propagate.
  if (typeof e === 'object' && e && 'digest' in e && typeof (e as { digest: unknown }).digest === 'string' && /DYNAMIC_SERVER_USAGE|NEXT_REDIRECT|NEXT_NOT_FOUND/.test((e as { digest: string }).digest)) throw e;
  if (e instanceof ApiError) return json({ error: e.message, details: e.details }, e.status);
  if (e instanceof ZodError) {
    const first = e.issues[0];
    return json({ error: first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input', details: e.flatten() }, 400);
  }
  if (typeof e === 'object' && e && 'code' in e && (e as { code: number }).code === 11000) {
    return json({ error: 'A record with these details already exists' }, 409);
  }
  console.error('[FinWise API]', e);
  return json({ error: 'Something went wrong. Please try again.' }, 500);
}

export async function parseBody<S extends ZodTypeAny>(req: Request, schema: S): Promise<ZodInfer<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, 'Invalid JSON body');
  }
  return schema.parse(body);
}

export function isObjectId(id: string) {
  return /^[a-f\d]{24}$/i.test(id);
}

export function assertId(id: string) {
  if (!isObjectId(id)) throw new ApiError(404, 'Not found');
}

export function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
