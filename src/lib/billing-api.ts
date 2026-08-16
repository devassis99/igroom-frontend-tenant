import { request } from "./http";
import type { BillingCycle } from "./sample-data";

/**
 * Talks to igroom-backend's public GET /billing/products (see
 * products.service.ts's listCatalog) — the same catalog the back
 * office's Plans page manages (create/archive products & prices). No
 * auth required. ChoosePlanPage renders straight from this instead of a
 * hardcoded plan list, so an admin changing a price or archiving a plan
 * in the BO shows up here immediately, no frontend deploy needed.
 */

export type BillingInterval = "month" | "quarter" | "half_year" | "year";

export interface CatalogPrice {
  id: string;
  productId: string;
  billingInterval: BillingInterval;
  /** Cents — the full amount charged per billing occurrence at this cadence (e.g. the whole annual total, not a monthly-equivalent). */
  unitAmount: number;
  currency: string;
  trialDaysOverride: number | null;
  isActive: boolean;
}

export interface CatalogProduct {
  id: string;
  key: string;
  name: string;
  description: string | null;
  features: string[];
  limits: Record<string, number>;
  trialDays: number;
  isActive: boolean;
  sortOrder: number;
  prices: CatalogPrice[];
}

export interface CatalogResponse {
  products: CatalogProduct[];
}

export function getCatalog(): Promise<CatalogResponse> {
  return request<CatalogResponse>("/billing/products");
}

/**
 * The tenant frontend's UI-friendly cadence names mapped onto the
 * backend's Stripe-ish billingInterval enum — mirrors igroom-backend's
 * accounts.service.ts BILLING_CYCLE_TO_INTERVAL. Kept here rather than
 * re-exported from there since this is a browser bundle, not a shared
 * package.
 */
export const BILLING_CYCLE_TO_INTERVAL: Record<BillingCycle, BillingInterval> = {
  monthly: "month",
  quarterly: "quarter",
  biannual: "half_year",
  annual: "year",
};

const MONTHS_PER_INTERVAL: Record<BillingInterval, number> = {
  month: 1,
  quarter: 3,
  half_year: 6,
  year: 12,
};

/** The active price for a product at a given UI cadence, or undefined if the back office hasn't configured one for it. */
export function priceForCycle(
  product: CatalogProduct,
  cycle: BillingCycle,
): CatalogPrice | undefined {
  const interval = BILLING_CYCLE_TO_INTERVAL[cycle];
  return product.prices.find((p) => p.billingInterval === interval && p.isActive);
}

/** Whole-dollar monthly-equivalent rate for a plan card's "$30/mo" style — never the lump sum actually charged (see centsToDollars for that). */
export function monthlyEquivalentDollars(price: CatalogPrice): number {
  const months = MONTHS_PER_INTERVAL[price.billingInterval];
  return Math.round(price.unitAmount / months / 100);
}

/** Cents to a "12.34"-style dollar string, for checkout/receipt totals — the real amount charged at that cadence. */
export function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}
