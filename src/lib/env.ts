import { z } from "zod";

/**
 * Single source of truth for build-time env vars, same pattern as
 * igroom-frontend-bo's src/lib/env.ts — fail loudly at startup instead of a
 * confusing runtime error the first time something reads an unset value.
 *
 * Nothing in this app calls VITE_API_BASE_URL yet: igroom-backend has no
 * tenant/shop-owner endpoints (auth, bookings, staff, ...) as of this
 * scaffold (see README's "Still to do"), so every page runs on sample data
 * and src/auth's client-only mock session. Validating it here anyway keeps
 * src/lib/http.ts ready to point at a real API the moment those endpoints
 * exist, instead of every page needing an env-var migration later.
 */
const envSchema = z.object({
  VITE_API_BASE_URL: z.string().url({ message: "VITE_API_BASE_URL must be a valid URL" }),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables — check your .env file against .env.example");
}

export const env = parsed.data;
