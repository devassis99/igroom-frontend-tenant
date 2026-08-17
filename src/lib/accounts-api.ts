import { request } from "./http";
import type { BillingCycle } from "./sample-data";

/**
 * Talks to igroom-backend's /accounts module (see accounts.service.ts) —
 * the real signup/login/Google-auth endpoints backing this app's
 * previously mock-only signup funnel and session.
 */

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export type GoogleLoginOutcome =
  | { status: "ok"; accessToken: string; refreshToken: string }
  | { status: "no_account"; email: string; name?: string };

export function loginWithGoogle(idToken: string): Promise<GoogleLoginOutcome> {
  return request<GoogleLoginOutcome>("/accounts/google", {
    method: "POST",
    body: { idToken },
  });
}

export interface LoginPayload {
  email: string;
  password: string;
}

/**
 * Email/password sign-in for a returning owner — POST /accounts/login on
 * igroom-backend (accounts.service.ts's login()). Throws ApiError(401,
 * "Invalid email or password") on a bad credential pair, same shape LoginPage
 * surfaces directly under the form.
 */
export function login(payload: LoginPayload): Promise<TokenPair> {
  return request<TokenPair>("/accounts/login", {
    method: "POST",
    body: payload,
  });
}

/**
 * Exchanges a still-valid refresh token for a brand-new access/refresh
 * pair — POST /accounts/refresh (accounts.service.ts's refreshSession).
 * Not called from here directly: http.ts's `request()` calls this same
 * endpoint itself so it can transparently recover from an expired 15-minute
 * access token and retry whatever call just failed (see that file's
 * comment). Exported here too so it stays a normal, discoverable part of
 * this module's /accounts surface, alongside login/signup/logout.
 */
export function refresh(refreshToken: string): Promise<TokenPair> {
  return request<TokenPair>("/accounts/refresh", {
    method: "POST",
    body: { refreshToken },
  });
}

export interface CreateCheckoutSessionPayload {
  planKey: string;
  billingCycle: BillingCycle;
  email?: string;
}

export interface CheckoutSessionResponse {
  /** Stripe-hosted Checkout page — redirect the browser here (window.location.href). */
  url: string;
  sessionId: string;
}

/**
 * ChoosePlanPage calls this right before redirecting the browser to
 * Stripe's real hosted Checkout page for the plan/price picked. No
 * account exists yet at this point — signup() (called later, from
 * BusinessDetailsPage) is what actually verifies the resulting session
 * and creates the account.
 */
export function createCheckoutSession(
  payload: CreateCheckoutSessionPayload,
): Promise<CheckoutSessionResponse> {
  return request<CheckoutSessionResponse>("/accounts/checkout-session", {
    method: "POST",
    body: payload,
  });
}

export interface SignupPayload {
  fullName: string;
  workEmail: string;
  password?: string;
  googleIdToken?: string;
  businessName: string;
  category?: string;
  /** No longer collected during onboarding (see BusinessDetailsPage) — optional, add later via Settings' Locations page. */
  address?: string;
  phone?: string;
  planKey: string;
  billingCycle: BillingCycle;
  /** The completed Stripe Checkout Session id from createCheckoutSession — see ChoosePlanPage/BusinessDetailsPage. */
  stripeCheckoutSessionId: string;
}

export function signup(payload: SignupPayload): Promise<TokenPair> {
  return request<TokenPair>("/accounts/signup", {
    method: "POST",
    body: payload,
  });
}

export interface MeResponse {
  staffUser: {
    id: string;
    accountId: string;
    locationId: string;
    name: string;
    email: string;
    roleId: string | null;
    roleName: string;
  };
  /** Permission keys granted to staffUser.roleId — see use-permissions.ts. */
  permissions: string[];
  account: Record<string, unknown> | null;
  location: Record<string, unknown> | null;
}

export function getMe(accessToken: string): Promise<MeResponse> {
  return request<MeResponse>("/accounts/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
