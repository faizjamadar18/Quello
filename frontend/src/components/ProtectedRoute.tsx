'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';

/**
 * Client-side backstop to the edge gate (src/middleware.ts).
 *
 * Middleware admits anyone holding the session cookie; the token's
 * validity is only known after a /auth/me round-trip, which happens here.
 * Three states, all deliberate:
 * - verifying → full-screen spinner (no internal content may render yet);
 * - transient verify failure → honest reconnect state. The session is
 *   never invalidated for cold starts / dropped requests, and the provider
 *   re-probes with backoff, so this heals itself without a false logout;
 * - really signed out → /login?next=… carrying the deep link.
 */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, loading, verifyFailed, refreshUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading || verifyFailed || isAuthenticated) return;
    // Signed out (no token, or a probe rejected it): return the user to
    // exactly where they came from after sign-in.
    const next = encodeURIComponent(pathname || '/home');
    router.push(`/login?next=${next}`);
  }, [isAuthenticated, loading, verifyFailed, pathname, router]);

  useEffect(() => {
    if (
      !loading &&
      isAuthenticated &&
      user?.onboarding_completed === false &&
      !pathname?.startsWith('/onboarding')
    ) {
      // Letter-never-lost: carry deep links (e.g. /join/{token}) through onboarding.
      router.push(`/onboarding/welcome?next=${encodeURIComponent(pathname || '/home')}`);
    }
  }, [isAuthenticated, loading, user, verifyFailed, pathname, router]);

  // Reacting to a transient verify failure while a user is already verified?
  // Keep rendering: the shell stays usable on real responses, and the
  // provider self-heals. The reconnect state is for the unverified case.
  if (loading && !verifyFailed) {
    return (
      <div className="flex h-screen items-center justify-center bg-base">
        <div className="w-5 h-5 border-3 border-white/10 border-l-white rounded-full animate-spin"></div>
      </div>
    );
  }

  if (verifyFailed && !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-base px-6">
        <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-8 text-center space-y-4">
          <div className="w-11 h-11 rounded-xl bg-sidebar border border-border flex items-center justify-center mx-auto">
            <svg
              className="w-5 h-5 text-text-secondary"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M17.5 18a4.5 4.5 0 1 0 0-9h-1.8A7 7 0 1 0 4 14.9" />
              <path d="M2.5 18h15" />
            </svg>
          </div>
          <h1 className="text-base font-semibold text-text-primary">Can&apos;t reach Quello</h1>
          <p className="text-xs text-text-secondary leading-relaxed">
            The backend may still be waking up. Your session is safe — attempting
            again won&apos;t sign you out.
          </p>
          <button
            type="button"
            onClick={() => void refreshUser()}
            className="w-full h-10 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-medium transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Brief hand-off state while the router pushes to sign-in — never a
    // blank void, and never internal page content.
    return (
      <div className="flex h-screen items-center justify-center bg-base">
        <div className="w-5 h-5 border-3 border-white/10 border-l-white rounded-full animate-spin"></div>
      </div>
    );
  }

  return <>{children}</>;
}
