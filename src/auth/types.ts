import type { BillingCycle } from "@/lib/sample-data";

/**
 * Set when this tab is a back-office support session rather than a real
 * login — see pages/SupportSessionPage.tsx and igroom-backend's
 * modules/support-sessions. Its presence is what makes the session
 * read-only from the UI's point of view; the API enforces that
 * independently, on every request.
 */
export interface SupportSession {
  sessionId: string;
  shopName: string;
  /** ISO timestamp. The bar counts down to this, and the backend refuses the token past it. */
  expiresAt: string;
}

/** The shop owner's account, as collected through the signup funnel (T2/T3/T3b-e). */
export interface OwnerAccount {
  fullName: string;
  workEmail: string;
  businessName: string;
  category: string;
  address: string;
  phone: string;
  /** billingProducts.key from igroom-backend's catalog, e.g. "solo_chair" — see billing-api.ts. */
  planKey: string;
  planName: string;
  /** The real amount charged per billing occurrence at billingCycle's cadence — from the selected CatalogPrice, not a locally recomputed discount. */
  priceCents: number;
  currency: string;
  billingCycle: BillingCycle;
  seats: number;
}
