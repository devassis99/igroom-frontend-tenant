import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface StaffOnboardingState {
  /** True between redeeming an invite and finishing the wizard. Gates the /welcome route. */
  active: boolean;
  /** Their name as the owner typed it on the invite — the wizard offers it back for correction. */
  name: string;
  /**
   * True when they have neither a password nor a linked Google account.
   * The invite link is burnt by the time they get here, so the wizard
   * must not let them leave without setting one of the two — there would
   * be no way back in. Flipped false the moment a password is set.
   */
  needsSignInMethod: boolean;
  begin: (input: { name: string; needsSignInMethod: boolean }) => void;
  setName: (name: string) => void;
  markSignInMethodSet: () => void;
  finish: () => void;
}

/**
 * The invited member's equivalent of onboarding-store.ts.
 *
 * Deliberately much smaller than the owner's: that one accumulates a
 * whole signup (business details, plan, Stripe session) because no
 * account exists until the very end. Here the account already exists and
 * the session is real from the first step, so each step can just save
 * itself against the API — this store only has to remember that the
 * wizard is in progress and what still has to happen before it can end.
 *
 * Persisted for the same reason the owner's is: a half-finished setup
 * shouldn't be lost to a refresh or an accidental tab close.
 */
export const useStaffOnboardingStore = create<StaffOnboardingState>()(
  persist(
    (set) => ({
      active: false,
      name: "",
      needsSignInMethod: false,
      begin: ({ name, needsSignInMethod }) => set({ active: true, name, needsSignInMethod }),
      setName: (name) => set({ name }),
      markSignInMethodSet: () => set({ needsSignInMethod: false }),
      finish: () => set({ active: false, name: "", needsSignInMethod: false }),
    }),
    {
      name: "igroom-staff-onboarding",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
