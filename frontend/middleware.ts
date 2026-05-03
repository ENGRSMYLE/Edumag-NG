import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/signup', '/set-password', '/select-school'];
const LANDING_ROUTE = '/';

const ROLE_HOME: Record<string, string> = {
  super_admin: '/dashboard/super-admin',
  admin: '/dashboard/admin',
  teacher: '/dashboard/staff',
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  const isLanding = pathname === LANDING_ROUTE;
  const isDashboard = pathname.startsWith('/dashboard');

  const accessToken = request.cookies.get('access_token')?.value;

  // No token: protect dashboard routes
  if (!accessToken) {
    if (isDashboard) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  const payload = decodeJwtPayload(accessToken);

  // Malformed token — clear cookies and redirect to login
  if (!payload) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('access_token');
    response.cookies.delete('refresh_token');
    return response;
  }

  const exp = typeof payload.exp === 'number' ? payload.exp : null;
  if (exp && Date.now() / 1000 > exp) {
    // Expired — clear cookies; let the page handle silent refresh or redirect
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('access_token');
    response.cookies.delete('refresh_token');
    return response;
  }

  const role = typeof payload.role === 'string' ? payload.role : null;
  const roleHome = role ? ROLE_HOME[role] : null;

  // Authenticated user on a public auth page → send to their dashboard
  if (isPublicRoute && roleHome) {
    return NextResponse.redirect(new URL(roleHome, request.url));
  }

  // Dashboard access: ensure user only visits their own role's section
  if (isDashboard && roleHome && !pathname.startsWith(roleHome)) {
    return NextResponse.redirect(new URL(roleHome, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
