const TOKEN_KEY = 'notebooklm_token';
export const TOKEN_CHANGED_EVENT = 'quello:token-changed';

/**
 * Middleware-readable mirror of the session (see src/middleware.ts).
 *
 * The JWT itself stays the single source of truth in localStorage for API
 * calls; the cookie only tells the edge gate "a client session exists and
 * deserves a render", so signed-out visitors never see internal pages.
 * Written/cleared by exactly the same calls as the token, keeping the
 * two in lockstep (401s, logout, cross-tab sign-out all funnel here).
 * Presence is not validity: a dead token passes the gate but fails the
 * in-app verify, which then clears token + cookie together.
 */
const SESSION_COOKIE_KEY = 'quello_token';
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function writeSessionCookie(value: string | null) {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; secure' : '';
  if (value) {
    document.cookie = `${SESSION_COOKIE_KEY}=${encodeURIComponent(value)}; path=/; max-age=${SESSION_COOKIE_MAX_AGE}; samesite=lax${secure}`;
  } else {
    // max-age=0 deletes the cookie without needing the old value.
    document.cookie = `${SESSION_COOKIE_KEY}=; path=/; max-age=0; samesite=lax${secure}`;
  }
}

function emitTokenChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(TOKEN_CHANGED_EVENT));
  }
}

export const auth = {
  getToken: () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(TOKEN_KEY);
    }
    return null;
  },

  setToken: (token: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, token);
      writeSessionCookie(token);
      emitTokenChanged();
    }
  },

  removeToken: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      writeSessionCookie(null);
      emitTokenChanged();
    }
  },

  isAuthenticated: () => {
    return !!auth.getToken();
  },

  /**
   * Defensive backstop for sessions created before the cookie mirror
   * existed (or for storage states the pre-hydration script missed):
   * rewrite the cookie from storage. Returns true when a session exists.
   */
  ensureSessionCookie: () => {
    if (typeof window === 'undefined') return false;
    const token = auth.getToken();
    if (token) writeSessionCookie(token);
    return !!token;
  },
};
