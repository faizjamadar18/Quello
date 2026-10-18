import { NextRequest, NextResponse } from 'next/server';

/**
 * Edge gate for Quello — the standard SaaS auth boundary.
 *
 * Internal routes are served ONLY when the browser presents a session
 * cookie (`quello_token`, mirrored from localStorage by lib/auth.ts).
 * Signed-out deep links get a server redirect straight to sign-in with
 * the full deep link preserved (`next`), so an unauthenticated visitor
 * never downloads, sees, or "gets stuck" on an internal page.
 *
 * (Next 16 file convention: proxy.ts — the middleware.ts name is
 * deprecated and renamed to proxy.)
 *
 * Cookie presence is not token validity: the cookie only admits a visitor
 * to the app shell. The real verification still happens once mounted
 * (AuthContext / ProtectedRoute against /auth/me). A dead token therefore
 * fails the verify inside the app and gets cleared there — it must never
 * be possible to fail the gate with a *false negative*.
 */

/** Public pages: landing, auth pages, static legal. */
const PUBLIC_ROUTES = ['/', '/login', '/register', '/terms', '/privacy', '/auth/signin'];

/**
 * Internal prefixes requiring a session. `/join` (invite acceptance needs
 * auth lookup) and `/onboarding` (their own client guards continue the
 * flow after sign-in via `next`) are gated like app routes.
 */
const INTERNAL_PREFIXES = [
  '/home',
  '/studio',
  '/assets',
  '/settings',
  '/connectors',
  '/playground',
  '/mcp',
  '/join',
  '/onboarding',
];

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.includes(pathname);
}

function isInternalRoute(pathname: string) {
  return INTERNAL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!isInternalRoute(pathname) || isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('quello_token')?.value;
  if (sessionCookie) return NextResponse.next();

  // Signed-out on an internal route: bounce to sign-in carrying the exact
  // path + query (deep links, /join/:token invites, /mcp/authorize flows).
  const login = request.nextUrl.clone();
  login.pathname = '/login';
  login.search = '';
  login.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // Skip Next internals and anything file-like (favicon.ico, icons/*.svg).
  // Query strings are not part of pathname, so /mcp/authorize?… still runs.
  matcher: ['/((?!_next|.*\\..*).*)'],
};
