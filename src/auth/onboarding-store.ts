import { create } from "zustand";
import type { BillingCycle } from "@/lib/sample-data";

/**
 * Holds the in-progress signup funnel (T2 → T3 → T3b-e → T4 → T5) across
 * route navigations. Not persisted — abandoning signup mid-flow (closing
 * the tab) should start fresh, matching how the mockup's steps behave.
 */
interface OnboardingState {
  fullName: string;
  workEmail: string;
  password: string;
  businessName: string;
  category: string;
  address: string;
  phone: string;
  billingCycle: BillingCycle;
  planId: string | null;
  setAccountDetails: (fields: Partial<Pick<OnboardingState, "fullName" | "workEmail" | "password">>) => void;
  setBusinessDetails: (
    fields: Partial<Pick<OnboardingState, "businessName" | "category" | "address" | "phone">>,
  ) => void;
  setBillingCycle: (cycle: BillingCycle) => void;
  selectPlan: (planId: string) => void;
}

export const useOnboardingStore = create<OnboardingState>()((set) => ({
  fullName: "",
  workEmail: "",
  password: "",
  businessName: "",
  category: "Barbershop",
  address: "",
  phone: "",
  billingCycle: "monthly",
  planId: null,
  setAccountDetails: (fields) => set(fields),
  setBusinessDetails: (fields) => set(fields),
  setBillingCycle: (billingCycle) => set({ billingCycle }),
  selectPlan: (planId) => set({ planId }),
}));
