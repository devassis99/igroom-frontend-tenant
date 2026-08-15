import type { BillingCycle } from "@/lib/sample-data";

/** The shop owner's account, as collected through the signup funnel (T2/T3/T3b-e). */
export interface OwnerAccount {
  fullName: string;
  workEmail: string;
  businessName: string;
  category: string;
  address: string;
  phone: string;
  planId: string;
  planName: string;
  billingCycle: BillingCycle;
  seats: number;
}
