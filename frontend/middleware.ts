import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/signup', '/set-password', '/select-school'];
const LANDING_ROUTE = '/';

const ROLE_HOME: Record<string, string> = {
  super_admin: '/dashboard/super-admin',
  admin: '/dashboard/admin',
  teacher: '/dashboard/staff',
  parent: '/dashboard/parent',
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  const isLanding = pathname === LANDING_ROUTE;
  const isDashboard = pathname.startsWith('/dashboard');

  // _auth_role is a JS-readable routing hint set on THIS domain by the auth
  // store after login and renewed after a successful silent token refresh.
  // The real credentials remain in the API domain's httpOnly cookies.
  const role = request.cookies.get('_auth_role')?.value ?? null;
  const isAuthenticated = !!role;
  const roleHome = role ? ROLE_HOME[role] : null;

  // Not authenticated: protect dashboard routes
  if (!isAuthenticated) {
    if (isDashboard) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  // Authenticated on a public auth page → send to their dashboard
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
