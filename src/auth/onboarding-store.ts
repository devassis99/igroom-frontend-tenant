import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { BillingCycle } from "@/lib/sample-data";

/** A snapshot of the real igroom-backend price at the moment ChoosePlanPage's card was clicked — see billing-api.ts. */
export interface SelectedPlan {
  productId: string;
  key: string;
  name: string;
  priceCents: number;
  currency: string;
  trialDays: number;
}

/**
 * Holds the in-progress signup funnel (Account → Plan → Business details,
 * with Stripe's real hosted Checkout as an external redirect in between —
 * see ChoosePlanPage's comment) across route navigations.
 *
 * Persisted to sessionStorage (not localStorage) rather than kept purely
 * in memory: picking a plan sends the browser to checkout.stripe.com, a
 * real cross-origin navigation that unloads this app entirely, so an
 * in-memory-only store would come back empty once Stripe redirects to
 * /signup/business — losing the email/name/password/plan collected so
 * far and stranding the visitor. sessionStorage survives that round trip
 * within the same tab while still clearing if the visitor abandons
 * signup by closing the tab, matching the original "start fresh" intent.
 *
 * Note this means `password` sits in sessionStorage in plaintext for the
 * few seconds a visitor is on Stripe's page — an acceptable tradeoff for
 * a short-lived signup wizard, same class of tradeoff as auth-store's
 * localStorage token persistence; revisit before shipping.
 */
interface OnboardingState {
  fullName: string;
  workEmail: string;
  password: string;
  /**
   * Set once CreateAccountPage's "Sign up with Google" flow verifies a
   * Google identity with no matching staff account yet (see
   * accounts-api.ts's loginWithGoogle "no_account" outcome). Carried
   * through the rest of the wizard and sent to POST /accounts/signup by
   * BusinessDetailsPage instead of `password` — the backend requires
   * exactly one of the two. Cleared if the visitor instead types a
   * password (setAccountDetails below), so the two paths can never both
   * be set.
   */
  googleIdToken: string | null;
  businessName: string;
  category: string;
  address: string;
  phone: string;
  billingCycle: BillingCycle;
  selectedPlan: SelectedPlan | null;
  setAccountDetails: (
    fields: Partial<Pick<OnboardingState, "fullName" | "workEmail" | "password">>,
  ) => void;
  setGoogleIdentity: (fields: {
    googleIdToken: string;
    fullName?: string;
    workEmail: string;
  }) => void;
  setBusinessDetails: (
    fields: Partial<Pick<OnboardingState, "businessName" | "category" | "address" | "phone">>,
  ) => void;
  setBillingCycle: (cycle: BillingCycle) => void;
  selectPlan: (plan: SelectedPlan) => void;
  /** Clears everything back to defaults — called once signup() succeeds so a later visit to /signup doesn't resurrect a finished wizard. */
  reset: () => void;
}

const initialState = {
  fullName: "",
  workEmail: "",
  password: "",
  googleIdToken: null as string | null,
  businessName: "",
  category: "Barbershop",
  address: "",
  phone: "",
  billingCycle: "monthly" as BillingCycle,
  selectedPlan: null as SelectedPlan | null,
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initialState,
      setAccountDetails: (fields) =>
        set((state) => ({
          ...fields,
          // Typing a password after a Google sign-up switches this visitor
          // back to the password path — only one of the two should ever
          // reach POST /accounts/signup.
          googleIdToken: fields.password ? null : state.googleIdToken,
        })),
      setGoogleIdentity: ({ googleIdToken, fullName, workEmail }) =>
        set((state) => ({
          googleIdToken,
          workEmail,
          fullName: fullName ?? state.fullName,
          password: "",
        })),
      setBusinessDetails: (fields) => set(fields),
      setBillingCycle: (billingCycle) => set({ billingCycle }),
      selectPlan: (selectedPlan) => set({ selectedPlan }),
      reset: () => set({ ...initialState }),
    }),
    {
      name: "igroom-tenant-onboarding",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        fullName: state.fullName,
        workEmail: state.workEmail,
        password: state.password,
        googleIdToken: state.googleIdToken,
        businessName: state.businessName,
        category: state.category,
        address: state.address,
        phone: state.phone,
        billingCycle: state.billingCycle,
        selectedPlan: state.selectedPlan,
      }),
    },
  ),
);
