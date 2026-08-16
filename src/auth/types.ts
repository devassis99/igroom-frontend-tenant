import type { BillingCycle } from "@/lib/sample-data";

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
