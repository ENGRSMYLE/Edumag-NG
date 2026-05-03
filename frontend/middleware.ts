import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/signup', '/set-password', '/select-school'];
const LANDING_ROUTE = '/';

const ROLE_HOME: Record<string, string> = {
  super_admin: '/dashboard/super-admin',
  admin: '/dashboard/admin',
  teacher: '/dashboard/staff',
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  const isLanding = pathname === LANDING_ROUTE;
  const isDashboard = pathname.startsWith('/dashboard');

  // _auth_role is a short-lived JS-readable cookie set on THIS domain by the
  // auth store after login. It carries the user's role for routing only.
  // The real JWT lives in the httpOnly cookie on the API domain.
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
