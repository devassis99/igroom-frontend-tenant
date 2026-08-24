import { z } from "zod";

/**
 * Single source of truth for build-time env vars, same pattern as
 * igroom-frontend-bo's src/lib/env.ts — fail loudly at startup instead of a
 * confusing runtime error the first time something reads an unset value.
 *
 * igroom-backend now has real tenant/shop-owner endpoints under
 * /accounts (see src/lib/accounts-api.ts) — VITE_API_BASE_URL and
 * VITE_GOOGLE_CLIENT_ID back the signup funnel's real API calls and its
 * "Sign up with Google" button (src/lib/google-identity.ts).
 * VITE_GOOGLE_CLIENT_ID must be the exact same OAuth client as
 * igroom-backend's GOOGLE_CLIENT_ID — the backend verifies the ID token's
 * audience against it.
 */
const envSchema = z.object({
  VITE_API_BASE_URL: z.string().url({ message: "VITE_API_BASE_URL must be a valid URL" }),
  VITE_GOOGLE_CLIENT_ID: z.string().min(1, "VITE_GOOGLE_CLIENT_ID is required for Google sign-up"),
  // Stripe's *publishable* key (pk_test_… / pk_live_…) — safe to ship in
  // a browser bundle by design; the secret key stays on igroom-backend.
  // Billing & Plan's Add-card flow loads Stripe.js with this and confirms
  // the card straight against Stripe, so no card data ever reaches our
  // own API. Required rather than optional, per this file's fail-loudly
  // rule: an unset key would surface as a blank card form at the exact
  // moment an owner is trying to pay.
  VITE_STRIPE_PUBLISHABLE_KEY: z
    .string()
    .min(1, "VITE_STRIPE_PUBLISHABLE_KEY is required for the billing page"),
  /**
   * Where a location's QR code should send a customer — the public
   * booking site's origin, e.g. https://book.igroom.io. Codes resolve to
   * `<base>/l/<locationId>`.
   *
   * Optional, and the only optional var here, deliberately: that site
   * doesn't exist yet, and the rest of the app works fine without it.
   * Unset simply means the QR panel says it has nowhere to point rather
   * than printing a code that leads nowhere — which is worse than no code
   * at all once it's stuck to a shop window.
   */
  VITE_BOOKING_BASE_URL: z.string().url().optional(),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables — check your .env file against .env.example");
}

export const env = parsed.data;
