import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('housmata_session');
  const { pathname } = request.nextUrl;

  // Let static files, login page, and public APIs pass
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('.') || // e.g. favicon.ico, images
    pathname === '/login' ||
    pathname === '/reset-password' ||
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/api/auth/forgot-password') ||
    pathname.startsWith('/api/auth/reset-password') ||
    pathname.startsWith('/api/track') // Open tracking must remain public
  ) {
    return NextResponse.next();
  }

  // Redirect to login if session does not exist
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth/login (login endpoint)
     * - api/track (email tracking pixel)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api/auth/login|api/track|_next/static|_next/image|favicon.ico).*)',
  ],
};
