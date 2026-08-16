import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { BillingCycle } from "@/lib/sample-data";
import type { AvailabilityDay } from "@/lib/availability-api";

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
 * Holds the in-progress signup funnel (Account → Business details →
 * Availability → Plan, with Stripe's real hosted Checkout as an external
 * redirect between Plan and the new Receipt page — see ChoosePlanPage's
 * and ReceiptPage's comments) across route navigations.
 *
 * Persisted to localStorage (previously sessionStorage) so a visitor who
 * abandons signup partway through — closes the tab, comes back tomorrow —
 * resumes exactly where they left off instead of restarting at step 1.
 * `lastRoute` (below) is what makes that resume possible: LandingPage's
 * "Continue where you left off" banner sends a returning-but-unfinished
 * visitor to `onboarding.lastRoute` instead of always "/signup".
 * localStorage also still covers the original reason this was ever
 * persisted at all — picking a plan sends the browser to
 * checkout.stripe.com, a real cross-origin navigation that unloads this
 * app entirely, so an in-memory-only store would come back empty once
 * Stripe redirects to /signup/receipt.
 *
 * Note this means `password` now sits in localStorage in plaintext for
 * as long as a visitor leaves signup unfinished (previously just the few
 * seconds they were on Stripe's page) — an acceptable tradeoff for now,
 * same class of tradeoff as auth-store's localStorage token persistence;
 * revisit before shipping (e.g. drop plaintext password once the wizard
 * only ever carries a Google idToken, or store a short-lived draft
 * server-side instead).
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
   * ReceiptPage instead of `password` — the backend requires exactly one
   * of the two. Cleared if the visitor instead types a password
   * (setAccountDetails below), so the two paths can never both be set.
   */
  googleIdToken: string | null;
  businessName: string;
  category: string;
  address: string;
  phone: string;
  /**
   * The owner's picked weekly schedule from StaffAvailabilityPage — held
   * here (not sent anywhere yet) because that step now runs before an
   * account exists, so there's no staffUser/accessToken to call PUT
   * /availability/me with. `null` means the visitor clicked "Skip for
   * now"; ReceiptPage submits this (if not null) right after signup()
   * succeeds and a real session exists. Cleared alongside everything else
   * once that submit happens.
   */
  availabilityDays: AvailabilityDay[] | null;
  setAvailabilityDays: (days: AvailabilityDay[] | null) => void;
  billingCycle: BillingCycle;
  selectedPlan: SelectedPlan | null;
  /**
   * The signup step the visitor was last on — e.g. "/signup/plan". Each
   * wizard page records itself here on mount (see CreateAccountPage's,
   * BusinessDetailsPage's, StaffAvailabilityPage's, and ChoosePlanPage's
   * effects), and LandingPage's resume banner reads it to jump back there
   * instead of restarting at "/signup". Reset back to "/signup" alongside
   * everything else once signup() actually succeeds.
   */
  lastRoute: string;
  setLastRoute: (route: string) => void;
  /**
   * Stripe's completed Checkout Session id — captured from ReceiptPage's
   * `?session_id=` query param the moment Stripe redirects back, then
   * persisted here so it survives even if that URL gets lost (manually
   * edited, a plain reload, or resuming via `lastRoute`, which only
   * stores the path, not its query string). Without this, losing the URL
   * param meant the only way back was "/signup/plan" — re-running a real
   * Stripe Checkout (and a real charge) for a payment that had already
   * gone through. Cleared alongside everything else once signup()
   * succeeds, or once a fresh checkout starts (see ChoosePlanPage).
   */
  stripeCheckoutSessionId: string | null;
  setStripeCheckoutSessionId: (id: string | null) => void;
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
  availabilityDays: null as AvailabilityDay[] | null,
  billingCycle: "monthly" as BillingCycle,
  selectedPlan: null as SelectedPlan | null,
  lastRoute: "/signup",
  stripeCheckoutSessionId: null as string | null,
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
      setAvailabilityDays: (availabilityDays) => set({ availabilityDays }),
      setBillingCycle: (billingCycle) => set({ billingCycle }),
      selectPlan: (selectedPlan) => set({ selectedPlan }),
      setLastRoute: (lastRoute) => set({ lastRoute }),
      setStripeCheckoutSessionId: (stripeCheckoutSessionId) => set({ stripeCheckoutSessionId }),
      reset: () => set({ ...initialState }),
    }),
    {
      name: "igroom-tenant-onboarding",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        fullName: state.fullName,
        workEmail: state.workEmail,
        password: state.password,
        googleIdToken: state.googleIdToken,
        businessName: state.businessName,
        category: state.category,
        address: state.address,
        phone: state.phone,
        availabilityDays: state.availabilityDays,
        billingCycle: state.billingCycle,
        selectedPlan: state.selectedPlan,
        lastRoute: state.lastRoute,
        stripeCheckoutSessionId: state.stripeCheckoutSessionId,
      }),
    },
  ),
);
