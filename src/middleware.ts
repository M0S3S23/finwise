import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';

const PUBLIC_PAGES = ['/login', '/signup', '/offline'];
const OWNER_ONLY = ['/dashboard', '/reports', '/settings/team', '/settings/business', '/settings/categories'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PAGES.some((p) => pathname.startsWith(p));

  if (!session && !isPublic) {
    const url = new URL('/login', req.url);
    if (pathname !== '/') url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  if (session && (pathname === '/login' || pathname === '/signup' || pathname === '/')) {
    return NextResponse.redirect(new URL(session.role === 'owner' ? '/dashboard' : '/sales/new', req.url));
  }
  if (session && session.role !== 'owner' && OWNER_ONLY.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/sales/new', req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Pages only — API routes do their own auth; skip static assets & PWA files.
  matcher: ['/((?!api|_next/static|_next/image|icons|favicon.ico|sw.js|manifest.webmanifest|robots.txt).*)'],
};
