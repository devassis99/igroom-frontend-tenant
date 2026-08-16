import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OwnerAccount } from "./types";

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
  hydrate: () => void;
  loginWithSession: (params: {
    owner: OwnerAccount;
    accessToken: string;
    refreshToken: string;
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
      hydrate: () => set((state) => ({ status: state.owner ? "authenticated" : "anonymous" })),
      loginWithSession: ({ owner, accessToken, refreshToken }) =>
        set({ owner, accessToken, refreshToken, status: "authenticated" }),
      logOut: () =>
        set({ owner: null, accessToken: null, refreshToken: null, status: "anonymous" }),
    }),
    {
      name: "igroom-tenant-session",
      partialize: (state) => ({
        owner: state.owner,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        state?.hydrate();
      },
    },
  ),
);
