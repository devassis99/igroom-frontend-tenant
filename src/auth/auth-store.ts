import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OwnerAccount, SupportSession } from "./types";

interface AuthState {
  /**
   * "unknown" for one tick on first mount so route guards can avoid a
   * login-screen flash while zustand/persist rehydrates from storage —
   * same shape as igroom-frontend-bo's status field.
   */
  status: "unknown" | "authenticated" | "anonymous";
  owner: OwnerAccount | null;
  /**
   * Real session tokens from igroom-backend's /accounts endpoints (see
   * src/lib/accounts-api.ts) — no longer a client-only mock. accessToken
   * is short-lived (15m); refreshToken rotates via POST /accounts/refresh.
   * Persisting both to localStorage (via `persist` below) is a dev-app
   * tradeoff — an httpOnly-cookie session would be the harder-but-safer
   * choice for a production shop-owner app; revisit before shipping.
   */
  accessToken: string | null;
  refreshToken: string | null;
  /**
   * Non-null only when this tab was opened from the back office through a
   * support link (see pages/SupportSessionPage.tsx). A shop owner's own
   * login never sets this, which is why SupportSessionBar can key off it
   * and still be invisible to the shop.
   *
   * Persisted alongside the tokens, deliberately: an operator debugging a
   * shop *will* hard-refresh, and losing the session on every refresh
   * would make the feature useless. The exposure is bounded by the
   * session being read-only, capped at an hour, and revocable
   * server-side on its very next request.
   */
  support: SupportSession | null;
  /**
   * The caller's staff permission keys, mirrored here from
   * GET /accounts/me by use-permissions.ts and persisted, so a hard
   * reload can build the nav on the first frame instead of flashing a
   * half-empty sidebar while that request is in flight. Never the
   * enforcement boundary — see use-permissions.ts's comment.
   */
  permissions: string[];
  hydrate: () => void;
  loginWithSession: (params: {
    owner: OwnerAccount;
    accessToken: string;
    refreshToken: string;
  }) => void;
  /**
   * Swaps in a freshly-rotated token pair without touching `owner` — called
   * by http.ts's `request()` after it silently recovers from an expired
   * accessToken via POST /accounts/refresh (see that file's comment on the
   * retry-once flow). Keeps every already-mounted page's `accessToken`
   * selector in sync so their *next* call goes out with the new token
   * instead of the one that just got rejected.
   */
  setTokens: (params: { accessToken: string; refreshToken: string }) => void;
  setPermissions: (permissions: string[]) => void;
  /**
   * The support-session equivalent of loginWithSession. Takes no refresh
   * token because the backend issues none — a support session is a fixed
   * window that ends when its access token does, rather than something
   * that can quietly renew itself for days (see
   * support-sessions.service.ts).
   */
  startSupportSession: (params: {
    owner: OwnerAccount;
    accessToken: string;
    support: SupportSession;
    /** Comes back with the redeem response, so the nav renders correctly on the first frame. */
    permissions: string[];
  }) => void;
  logOut: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      status: "unknown",
      owner: null,
      accessToken: null,
      refreshToken: null,
      support: null,
      permissions: [],
      hydrate: () => set((state) => ({ status: state.owner ? "authenticated" : "anonymous" })),
      loginWithSession: ({ owner, accessToken, refreshToken }) =>
        // Clears `support`: signing in normally in a tab that had a
        // support session must not leave the read-only bar (or the
        // read-only assumptions behind it) hanging around.
        set({
          owner,
          accessToken,
          refreshToken,
          support: null,
          // Unknown until this session's own /accounts/me lands — never
          // inherited from whoever was signed in here before.
          permissions: [],
          status: "authenticated",
        }),
      startSupportSession: ({ owner, accessToken, support, permissions }) =>
        set({
          owner,
          accessToken,
          refreshToken: null,
          support,
          permissions,
          status: "authenticated",
        }),
      setTokens: ({ accessToken, refreshToken }) => set({ accessToken, refreshToken }),
      setPermissions: (permissions) => set({ permissions }),
      logOut: () =>
        set({
          owner: null,
          accessToken: null,
          refreshToken: null,
          support: null,
          // Cleared on logout so the next person to sign in on this
          // browser never renders a nav built from someone else's role
          // before their own /accounts/me lands.
          permissions: [],
          status: "anonymous",
        }),
    }),
    {
      name: "igroom-tenant-session",
      partialize: (state) => ({
        owner: state.owner,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        support: state.support,
        permissions: state.permissions,
      }),
      onRehydrateStorage: () => (state) => {
        state?.hydrate();
      },
    },
  ),
);
