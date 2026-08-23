import { request } from "./http";

/**
 * Talks to igroom-backend's /billing/payment-methods module (see
 * payment-methods.service.ts) — the T12g Billing & Plan page's "Payment
 * method" section. Every route requires a bearer token and the
 * billing.view / billing.manage permissions; accountId is derived from
 * the token server-side, same pattern as staff-api.ts.
 *
 * Nothing here ever carries a card number. The browser sends card
 * details straight to Stripe using the SetupIntent client secret from
 * createSetupIntent below (see AddCardModal), and this API only handles
 * opaque `pm_...` ids afterwards.
 */

export interface PaymentMethod {
  /** igroom's own row id (a uuid), not the Stripe `pm_...` id — that stays server-side. */
  id: string;
  /** Lowercase Stripe brand slug — "visa", "mastercard", "amex", … */
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  /** The card the live subscription is actually charged against. */
  isDefault: boolean;
}

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

export function listPaymentMethods(
  accessToken: string,
): Promise<{ paymentMethods: PaymentMethod[] }> {
  return request("/billing/payment-methods", { headers: authHeaders(accessToken) });
}

/** Opens an "Add card" flow — the returned secret is scoped to one SetupIntent and is what lets Stripe.js confirm the card in the browser. */
export function createSetupIntent(accessToken: string): Promise<{ clientSecret: string }> {
  return request("/billing/payment-methods/setup-intent", {
    method: "POST",
    headers: authHeaders(accessToken),
  });
}

/**
 * Records the card a just-succeeded SetupIntent produced. This is the
 * authoritative post-add call — the backend retrieves the intent by id
 * and stores whatever payment method it actually created, rather than
 * inferring it from a filtered list.
 */
export function recordSetupIntent(
  accessToken: string,
  setupIntentId: string,
): Promise<{ paymentMethods: PaymentMethod[] }> {
  return request("/billing/payment-methods/record-setup", {
    method: "POST",
    body: { setupIntentId },
    headers: authHeaders(accessToken),
  });
}

/**
 * Reconciles the account's saved cards against Stripe and returns the
 * refreshed list. The backend keeps its own payment_methods table in sync
 * via webhooks, but nobody runs `stripe listen` in local dev — so the Add
 * card flow calls this once after confirming, rather than showing a list
 * that's briefly missing the card just added. Also the manual repair path
 * if an event is ever missed in production.
 */
export function syncPaymentMethods(
  accessToken: string,
): Promise<{ paymentMethods: PaymentMethod[] }> {
  return request("/billing/payment-methods/sync", {
    method: "POST",
    headers: authHeaders(accessToken),
  });
}

/** All the mutating calls return the full refreshed list, so the caller can drop it straight into the query cache without a second round trip. */
export function setDefaultPaymentMethod(
  accessToken: string,
  paymentMethodId: string,
): Promise<{ paymentMethods: PaymentMethod[] }> {
  return request(`/billing/payment-methods/${paymentMethodId}/default`, {
    method: "POST",
    headers: authHeaders(accessToken),
  });
}

export function removePaymentMethod(
  accessToken: string,
  paymentMethodId: string,
): Promise<{ paymentMethods: PaymentMethod[] }> {
  return request(`/billing/payment-methods/${paymentMethodId}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
}

/** "visa" → "VISA", "american_express" → "AMERICAN EXPRESS". Stripe brand slugs are lowercase and underscore-separated. */
export function formatCardBrand(brand: string): string {
  return brand.replace(/_/g, " ").toUpperCase();
}

/** Stripe returns exp_month as 1-12 and exp_year as a full year — the card itself prints MM/YY. */
export function formatCardExpiry(expMonth: number, expYear: number): string {
  return `${String(expMonth).padStart(2, "0")}/${String(expYear).slice(-2)}`;
}
