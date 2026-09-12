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
   * Where a shop's public booking link points — the customer-facing
   * site's origin. Links resolve to `<base>/<account slug>` and
   * `<base>/<account slug>/<branch slug>`.
   *
   * Defaulted rather than optional, and defaulted to production rather
   * than to localhost, because of what this string is *for*: it is
   * copied out of this app and pasted into an Instagram bio, a Google
   * listing, a printed card. A link that quietly reads
   * "localhost:5175/thegentry" because a variable was forgotten is one
   * somebody hands to a customer, and it is wrong in the one place
   * nobody can correct it afterwards.
   *
   * Override it to preview against a local build of the customer app —
   * but know that the link on screen is then the one that gets copied.
   */
  VITE_BOOKING_BASE_URL: z.string().url().default("https://igroom.io"),
  // Mapbox *public* token (pk....) — safe in a browser bundle, but scope
  // it to this app's URLs in the Mapbox dashboard, since anyone can read
  // it from the page and bill map loads against your account. Used only
  // for tiles; address lookup goes through igroom-backend, which holds
  // its own token (see locations.service.ts).
  VITE_MAPBOX_ACCESS_TOKEN: z
    .string()
    .min(1, "VITE_MAPBOX_ACCESS_TOKEN is required to render maps"),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables — check your .env file against .env.example");
}

export const env = parsed.data;
