'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { useRouter } from 'next/navigation';
import { auth, TOKEN_CHANGED_EVENT } from '../lib/auth';
import { api, ApiError } from '../lib/api';
import type { User } from '../hooks/useAuth';

// Keep in sync with hooks/useAuth (string-duplicated to avoid a runtime import cycle).
const USER_UPDATED_EVENT = 'quello:user-updated';
const TOKEN_KEY = 'notebooklm_token';
const CACHE_TTL_MS = 60_000;

// Module-level single-flight cache: every useAuth instance on the page shares
// one /auth/me request instead of each firing its own on mount.
let cachedUser: User | null = null;
let cacheAt = 0;
let inflight: Promise<User | null> | null = null;

/**
 * Verify the held token against the backend (single-flight, module-cached).
 *
 * Resolution rules:
 * - definitive auth rejection (401/403): the session is really gone —
 *   clear every local trace and resolve null (api.ts has already wiped
 *   storage + cookie on the 401 itself).
 * - anything transient (network blip, cold backend 5xx): rethrow with the
 *   token and caches untouched. A Render cold start or a dropped request
 *   must never sign a live user out; callers classify and retry.
 */
async function verifySession(force = false): Promise<User | null> {
  if (!auth.isAuthenticated()) {
    cachedUser = null;
    cacheAt = 0;
    return null;
  }
  if (!force && cachedUser && Date.now() - cacheAt < CACHE_TTL_MS) {
    return cachedUser;
  }
  if (inflight) return inflight;
  inflight = api
    .get('/auth/me', { skipAuthRedirect: true })
    .then((userData) => {
      cachedUser = userData as User;
      cacheAt = Date.now();
      return cachedUser;
    })
    .catch((err: unknown) => {
      const status = err instanceof ApiError ? err.status : 0;
      if (status === 401 || status === 403) {
        // Background probe only: never a forced navigation (skipAuthRedirect
        // above). removeToken also emits TOKEN_CHANGED_EVENT so subscribers
        // re-render as signed out.
        auth.removeToken();
        cachedUser = null;
        cacheAt = 0;
        return null;
      }
      // Transient: keep the session, surface the failure for backoff retry.
      throw err;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

// --- Hydration-safe session reads (no set-state-in-effect) ---
// Server and first client paint both see `false`; the client snapshot
// (sync localStorage read, no network) applies immediately after hydration,
// so nav CTAs resolve on first paint instead of after a /auth/me round-trip.

function subscribeTokenChange(cb: () => void) {
  window.addEventListener(TOKEN_CHANGED_EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(TOKEN_CHANGED_EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}
function getTokenSnapshot() {
  return auth.isAuthenticated();
}
function getTokenServerSnapshot() {
  return false;
}
function subscribeNoop() {
  return () => {};
}
function getMountedSnapshot() {
  return true;
}
function getMountedServerSnapshot() {
  return false;
}

interface AuthSessionValue {
  user: User | null;
  /** True only after hydration (server/first paint see false). */
  mounted: boolean;
  /** Token present in storage (sync, no network). */
  hasToken: boolean;
  /**
   * Verification failed transiently (backend waking / network) while a
   * token is still held. The session is preserved; the UI shows a
   * reconnect state and the provider keeps retrying with backoff.
   */
  verifyFailed: boolean;
  /**
   * Optimistic session flag for low-stakes UI (nav CTAs): true when a token
   * exists locally or the user is verified. Never blocks on the network.
   */
  hasSession: boolean;
  /** Verified auth state. True only with a verified user and a token. */
  isAuthenticated: boolean;
  /**
   * Verification pending. False immediately for signed-out visitors
   * (no network call); true while a present token is being verified.
   */
  loading: boolean;
  logout: () => void;
  refreshUser: () => Promise<User | null>;
  setUser: Dispatch<SetStateAction<User | null>>;
}

const AuthSessionContext = createContext<AuthSessionValue | null>(null);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const mounted = useSyncExternalStore(
    subscribeNoop,
    getMountedSnapshot,
    getMountedServerSnapshot,
  );
  const hasToken = useSyncExternalStore(
    subscribeTokenChange,
    getTokenSnapshot,
    getTokenServerSnapshot,
  );
  const [user, setUserState] = useState<User | null>(() => cachedUser);
  // Backoff attempt counter for transient /auth/me failures; lives in a
  // ref so retry scheduling never re-renders on its own.
  const transientAttempts = useRef(0);
  const [verifyFailed, setVerifyFailed] = useState(false);

  /**
   * One classification point for every verify outcome. Definitive
   * rejections settle into a signed-out state; transient failures keep
   * the session and arm the backoff self-heal below.
   */
  const handleVerifyResult = useCallback((result: User | null, err: unknown) => {
    if (err !== null) {
      const status = err instanceof ApiError ? err.status : 0;
      if (status === 401 || status === 403) {
        // Really signed out (expired/removed user): api.ts already cleared
        // storage + cookie; settle the UI state so guards act on it.
        transientAttempts.current = 0;
        setVerifyFailed(false);
        setUserState(null);
        return;
      }
      // Transient: keep token + caches; escalate backoff.
      transientAttempts.current += 1;
      setVerifyFailed(true);
      return;
    }
    transientAttempts.current = 0;
    setVerifyFailed(false);
    setUserState(result);
  }, []);

  const verifyNow = useCallback((force: boolean) => {
    void verifySession(force)
      .then((result) => handleVerifyResult(result, null))
      .catch((err) => handleVerifyResult(null, err));
  }, [handleVerifyResult]);

  const setUser = useCallback<Dispatch<SetStateAction<User | null>>>((action) => {
    // Resolve against the module cache (all updates funnel through here,
    // so it always holds the latest user) and keep the value form for React
    // state to avoid impure updaters under StrictMode.
    const next =
      typeof action === 'function'
        ? (action as (prev: User | null) => User | null)(cachedUser)
        : action;
    cachedUser = next;
    cacheAt = next ? Date.now() : 0;
    setUserState(next);
  }, []);

  const clearSession = useCallback(() => {
    cachedUser = null;
    cacheAt = 0;
    transientAttempts.current = 0;
    setVerifyFailed(false);
    setUserState(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!auth.isAuthenticated()) {
      clearSession();
      return null;
    }
    try {
      const result = await verifySession(true);
      handleVerifyResult(result, null);
      return result;
    } catch (err) {
      handleVerifyResult(null, err);
      return null;
    }
  }, [clearSession, handleVerifyResult]);

  // Verify a present-but-unverified token in the background (initial mount,
  // same-tab login, cross-tab sign-in). State updates happen only in the
  // async continuation, never synchronously in the effect body.
  useEffect(() => {
    if (!hasToken) return;
    let cancelled = false;
    void verifySession(false)
      .then((result) => {
        if (!cancelled) handleVerifyResult(result, null);
      })
      .catch((err) => {
        if (!cancelled) handleVerifyResult(null, err);
      });
    return () => {
      cancelled = true;
    };
  }, [hasToken, handleVerifyResult]);

  // Self-heal after a transient verify failure: while the token survives,
  // keep probing. A Render cold start clears itself here (1.5s → ~15s cap)
  // without ever wiping the session or forcing a login redirect.
  useEffect(() => {
    if (!hasToken || !verifyFailed) return;
    const delay = Math.min(15_000, 1500 * 2 ** transientAttempts.current);
    const timer = window.setTimeout(() => verifyNow(true), delay);
    return () => window.clearTimeout(timer);
  }, [hasToken, verifyFailed, verifyNow]);

  // External auth changes: cross-tab storage events, same-tab token
  // mutations, and in-app profile updates. setState only in callbacks.
  useEffect(() => {
    const onAuthChange = (e: Event) => {
      if (e instanceof StorageEvent && e.key !== null && e.key !== TOKEN_KEY) return;
      if (!auth.isAuthenticated()) {
        clearSession();
      } else {
        void refreshUser();
      }
    };
    const onUserUpdated = () => {
      void refreshUser();
    };
    window.addEventListener(TOKEN_CHANGED_EVENT, onAuthChange);
    window.addEventListener('storage', onAuthChange);
    window.addEventListener(USER_UPDATED_EVENT, onUserUpdated);
    return () => {
      window.removeEventListener(TOKEN_CHANGED_EVENT, onAuthChange);
      window.removeEventListener('storage', onAuthChange);
      window.removeEventListener(USER_UPDATED_EVENT, onUserUpdated);
    };
  }, [clearSession, refreshUser]);

  const logout = useCallback(() => {
    auth.removeToken();
    clearSession();
    router.push('/login');
  }, [clearSession, router]);

  const value = useMemo<AuthSessionValue>(() => {
    const verified = !!user && hasToken;
    return {
      user,
      mounted,
      hasToken,
      verifyFailed,
      hasSession: mounted && (hasToken || !!user),
      isAuthenticated: verified,
      loading: !mounted || (hasToken && !user),
      logout,
      refreshUser,
      setUser,
    };
  }, [user, mounted, hasToken, verifyFailed, logout, refreshUser, setUser]);

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession(): AuthSessionValue {
  const ctx = useContext(AuthSessionContext);
  if (!ctx) throw new Error('useAuthSession must be used within an AuthSessionProvider');
  return ctx;
}
