import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

export async function middleware(req: NextRequest) {
  const secret = process.env.PANEL_SESSION_SECRET;
  const session = secret ? await verifySession(secret, req.cookies.get(SESSION_COOKIE)?.value) : null;
  if (session) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = req.nextUrl.pathname === '/' ? '' : `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!login|_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
