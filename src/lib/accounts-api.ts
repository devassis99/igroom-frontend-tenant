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

/** Returned by /accounts/login and /accounts/google when the account has 2FA enabled — password/Google identity checked out, but a live authenticator code is still needed. See confirmMfaLoginChallenge below. */
export interface MfaChallengeRequired {
  status: "mfa_challenge_required";
  challengeToken: string;
}

export type GoogleLoginOutcome =
  | { status: "ok"; accessToken: string; refreshToken: string }
  | MfaChallengeRequired
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

export type LoginOutcome =
  | { status: "ok"; accessToken: string; refreshToken: string }
  | MfaChallengeRequired;

/**
 * Email/password sign-in for a returning owner — POST /accounts/login on
 * igroom-backend (accounts.service.ts's login()). Throws ApiError(401,
 * "Invalid email or password") on a bad credential pair, same shape LoginPage
 * surfaces directly under the form. Returns a real session directly unless
 * the account has 2FA enabled, in which case it returns a
 * mfa_challenge_required outcome instead — see confirmMfaLoginChallenge.
 */
export function login(payload: LoginPayload): Promise<LoginOutcome> {
  return request<LoginOutcome>("/accounts/login", {
    method: "POST",
    body: payload,
  });
}

/**
 * Second step of a login for an account with 2FA enabled — trades the
 * challengeToken from login()/loginWithGoogle()'s mfa_challenge_required
 * outcome, plus a live authenticator app code, for a real session. Not
 * authenticated with a bearer token — the challengeToken itself, freshly
 * issued mid-login, is the credential.
 */
export function confirmMfaLoginChallenge(challengeToken: string, code: string): Promise<TokenPair> {
  return request<TokenPair>("/accounts/mfa/challenge", {
    method: "POST",
    body: { challengeToken, code },
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
    /** False for a caller who's only ever signed in with Google — see accounts.service.ts's getMeDetails. Drives SecuritySettingsPage's "Set password" vs "Change password" row label. */
    hasPassword: boolean;
    /** Whether this caller has TOTP 2FA enabled — see SetPasswordModal.tsx, which asks for an authenticator code instead of emailing one when this is true. */
    mfaEnabled: boolean;
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

/**
 * Security page's Set/Change password flow, step 1 — emails a 6-digit
 * code to the caller's own address. Only valid when staffUser.mfaEnabled
 * is false; a caller with 2FA enabled skips this and goes straight to
 * confirmSetPassword with their authenticator code instead (see
 * SetPasswordModal.tsx). Throws ApiError(409, ...) if called too soon
 * after a previous send (accounts.service.ts rate-limits to one a
 * minute) or while 2FA is actually enabled.
 */
export function requestPasswordResetCode(accessToken: string): Promise<void> {
  return request<void>("/accounts/security/password/request-code", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export interface ConfirmSetPasswordPayload {
  newPassword: string;
  /** The emailed code from requestPasswordResetCode — required unless the caller has 2FA enabled. */
  code?: string;
  /** The authenticator app code — required only when the caller has 2FA enabled. */
  totpCode?: string;
}

/**
 * Security page's Set/Change password flow, final step — verifies
 * whichever code was supplied and, on success, sets the new password and
 * emails a "your password was reset" confirmation. Works the same
 * whether this is a first-time Set password or a Change password on an
 * existing one.
 */
export function confirmSetPassword(
  accessToken: string,
  payload: ConfirmSetPasswordPayload,
): Promise<void> {
  return request<void>("/accounts/security/password/confirm", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: payload,
  });
}

export interface MfaSetupResult {
  /** Manual-entry fallback if the authenticator app can't scan the QR code. */
  secret: string;
  /** data: URL PNG — render directly as an <img src>. */
  qrCodeDataUrl: string;
}

/**
 * Security page's "Two-factor authentication" row, step 1 — generates a
 * pending TOTP secret and returns a QR code to scan. Doesn't turn 2FA on
 * yet; call confirmMfaSetup with the first live code to finish. Safe to
 * call again if the caller abandons setup partway — it just replaces the
 * pending secret.
 */
export function beginMfaSetup(accessToken: string): Promise<MfaSetupResult> {
  return request<MfaSetupResult>("/accounts/security/mfa/setup", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

/** Security page's "Two-factor authentication" row, step 2 — verifies the first live code and turns 2FA on. */
export function confirmMfaSetup(accessToken: string, code: string): Promise<void> {
  return request<void>("/accounts/security/mfa/confirm", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: { code },
  });
}

/** Security page's "Two-factor authentication" row when already enabled — verifies a live code and turns 2FA off. */
export function disableMfa(accessToken: string, code: string): Promise<void> {
  return request<void>("/accounts/security/mfa/disable", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: { code },
  });
}

export interface Session {
  id: string;
  /** Raw User-Agent header from when this session's current token was issued — see ActiveSessionsModal.tsx's describeUserAgent for the friendly label. Null for a session issued before this was tracked. */
  userAgent: string | null;
  /** When this session's *current* token was issued — refreshes roughly every 15 minutes of active use, so this reads as "last active", not "first signed in". */
  createdAt: string;
  /** True for the session this browser is asking from right now. */
  isCurrent: boolean;
}

/**
 * Security page's "Active sessions" row — lists every currently-valid
 * session for the caller. Passing the caller's own refreshToken (from
 * auth-store) lets the backend flag which entry is "this device" via
 * isCurrent, purely so the UI can warn before someone revokes the
 * session they're looking at it from.
 */
export function listSessions(
  accessToken: string,
  currentRefreshToken?: string,
): Promise<{ sessions: Session[] }> {
  return request<{ sessions: Session[] }>("/accounts/security/sessions", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(currentRefreshToken ? { "X-Refresh-Token": currentRefreshToken } : {}),
    },
  });
}

/** Security page's "Active sessions" row — logs out one specific session (its own "Log out" button). */
export function revokeSession(accessToken: string, sessionId: string): Promise<void> {
  return request<void>(`/accounts/security/sessions/${sessionId}/revoke`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

/** Security page's "Active sessions" row — "Log out of all other sessions", keeping the caller's own session alive. */
export function revokeOtherSessions(
  accessToken: string,
  currentRefreshToken: string,
): Promise<void> {
  return request<void>("/accounts/security/sessions/revoke-others", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: { currentRefreshToken },
  });
}
