import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OwnerAccount } from "./types";

interface AuthState {
  /**
   * "unknown" for one tick on first mount so route guards can avoid a
   * login-screen flash while zustand/persist rehydrates from storage —
   * same shape as igroom-frontend-bo's status field, minus the "unknown"
   * meaning a silent-refresh network call is in flight, since there's
   * nothing to refresh: igroom-backend has no tenant auth endpoints yet
   * (see README), so this whole session is a client-only mock created at
   * the end of the signup funnel (T5's "Go to Owner Dashboard").
   */
  status: "unknown" | "authenticated" | "anonymous";
  owner: OwnerAccount | null;
  hydrate: () => void;
  completeSignup: (owner: OwnerAccount) => void;
  logOut: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      status: "unknown",
      owner: null,
      hydrate: () =>
        set((state) => ({ status: state.owner ? "authenticated" : "anonymous" })),
      completeSignup: (owner) => set({ owner, status: "authenticated" }),
      logOut: () => set({ owner: null, status: "anonymous" }),
    }),
    {
      name: "igroom-tenant-session",
      partialize: (state) => ({ owner: state.owner }),
      onRehydrateStorage: () => (state) => {
        state?.hydrate();
      },
    },
  ),
);
