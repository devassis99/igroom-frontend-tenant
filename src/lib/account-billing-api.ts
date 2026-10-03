import { request } from "./http";
import type { BillingInterval } from "./billing-api";

/**
 * igroom-backend's account-billing module — the Billing & Plan page's
 * real data: the plan, the live Stripe subscription, usage against the
 * plan's cap, and every invoice. Invoice PDFs are served from our own S3
 * copy once an invoice settles (Stripe's links expire), so a download
 * always goes through getInvoicePdfUrl rather than a stored link.
 */

export interface BillingInvoice {
  id: string;
  number: string | null;
  /** Stripe's status: open | paid | void | uncollectible. */
  status: string;
  currency: string;
  /** Cents. */
  total: number;
  amountPaid: number;
  amountDue: number;
  periodStart: string | null;
  periodEnd: string | null;
  issuedAt: string;
  paidAt: string | null;
  archived: boolean;
}

export interface BillingOverview {
  plan: {
    name: string;
    billingInterval: BillingInterval;
    unitAmount: number;
    currency: string;
  } | null;
  accountStatus: "trial" | "active" | "past_due" | "suspended" | "cancelled";
  subscription: {
    /** Stripe's subscription status — trialing, active, past_due, canceled, … */
    status: string;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    nextCharge: { amount: number; currency: string; date: string | null } | null;
  } | null;
  /** Null when the plan has no cap. */
  seats: { unit: "chairs" | "locations"; used: number; limit: number } | null;
  invoices: BillingInvoice[];
  /** Set when Stripe couldn't be reached — the rest of the payload is what we already had. */
  stripeError: string | null;
}

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

export function getBillingOverview(accessToken: string): Promise<BillingOverview> {
  return request("/billing/overview", { headers: authHeaders(accessToken) });
}

export function getInvoicePdfUrl(accessToken: string, invoiceId: string): Promise<{ url: string }> {
  return request(`/billing/invoices/${invoiceId}/pdf`, { headers: authHeaders(accessToken) });
}

export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export function formatBillingDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
