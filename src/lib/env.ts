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
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables — check your .env file against .env.example");
}

export const env = parsed.data;
