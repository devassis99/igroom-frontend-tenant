import { useAuthStore } from "@/auth/auth-store";
import { router } from "@/routes/router";
import { env } from "./env";

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Skip JSON-encoding `body` (e.g. FormData). Off by default. */
  raw?: boolean;
  /**
   * Internal — set only on the one automatic retry `request()` makes after
   * a token refresh (see below), so a 401 on the retry itself fails for
   * good instead of refreshing forever.
   */
  isRetryAttempt?: boolean;
}

/** The actual fetch — no 401/refresh handling, so the retry in `request()` below can call this directly without recursing into itself. */
async function rawRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  // Renamed to `_isRetryAttempt` on the way in — this binding only exists
  // to keep `isRetryAttempt` out of `...rest` (fetch's RequestInit has no
  // such field); it's never read from here. The leading underscore satisfies
  // this repo's "unused vars must start with _" convention without ever
  // reading a leading-underscore *property* (that's what no-underscore-dangle
  // objects to — see `request()` below, which reads the un-prefixed field).
  const { body, raw, headers, isRetryAttempt: _isRetryAttempt, ...rest } = options;

  const response = await fetch(`${env.VITE_API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      ...(raw ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : raw ? (body as BodyInit) : JSON.stringify(body),
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json().catch(() => undefined) : undefined;

  if (!response.ok) {
    // igroom-backend's errorHandler (see error-handler.ts) always shapes
    // failures as `{ error: string }`, not `{ message: string }` — reading
    // the wrong key here meant every thrown ApiError fell back to the
    // generic "Request to ... failed" text below, silently swallowing
    // real backend messages like "An account already exists for this
    // email" or "Invalid email or password". `message` is still checked
    // as a fallback in case some endpoint ever shapes its body that way.
    const payloadMessage =
      payload && typeof payload === "object"
        ? ((payload as { error?: unknown; message?: unknown }).error ??
          (payload as { error?: unknown; message?: unknown }).message)
        : undefined;
    const message =
      typeof payloadMessage === "string" && payloadMessage.length > 0
        ? payloadMessage
        : `Request to ${path} failed with status ${response.status}`;
    throw new ApiError(response.status, message, payload);
  }

  return payload as T;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * De-duped in-flight refresh — igroom-backend's POST /accounts/refresh
 * (see accounts.service.ts's refreshSession) revokes the refresh token it's
 * handed the moment it's used, so two 401s landing at once (e.g.
 * ServicesPage's services + categories queries firing together) must share
 * one refresh call, not race two independent ones — the second would hand
 * back an already-revoked token and fail. Cleared once the call settles
 * (success or failure) so the *next* 401, whenever it happens, can start a
 * fresh one.
 */
let refreshPromise: Promise<TokenPair> | null = null;

function refreshTokens(): Promise<TokenPair> {
  if (!refreshPromise) {
    const currentRefreshToken = useAuthStore.getState().refreshToken;
    refreshPromise = currentRefreshToken
      ? rawRequest<TokenPair>("/accounts/refresh", {
          method: "POST",
          body: { refreshToken: currentRefreshToken },
        })
      : Promise.reject(new ApiError(401, "No refresh token available"));
    refreshPromise.finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * Bare fetch wrapper: base URL + JSON in/out + typed errors — identical
 * shape to igroom-frontend-bo's src/lib/http.ts, plus one thing bo doesn't
 * need: igroom-backend signs tenant access tokens with a 15-minute TTL
 * (see jwt.ts's ACCESS_TOKEN_TTL), so any session left open past that mark
 * used to have every account-authenticated call (services, availability,
 * ...) start failing with "Invalid or expired access token" until the
 * owner logged out and back in. A call is "account-authenticated" here
 * simply if it went out with an Authorization header — callers still build
 * that header themselves (see services-api.ts/availability-api.ts's
 * authHeaders helpers), this just watches for a 401 coming back on one.
 *
 * On that 401, this refreshes the token pair via POST /accounts/refresh,
 * updates auth-store so every other already-mounted page's `accessToken`
 * picks up the new one too, and retries the original call exactly once
 * with the new token. If the refresh itself fails (refresh token expired,
 * revoked, or missing — e.g. the owner is truly logged out elsewhere),
 * this clears the session and sends the browser straight to /login via
 * the router's own `navigate` (this module sits outside the component
 * tree, so it can't use the `useNavigate` hook AppShell's and
 * ActiveSessionsModal's logout handlers use) — ProtectedRoute
 * (routes/ProtectedRoute.tsx) redirects anonymous access to /login on its
 * own too, so this is just a faster, more direct path there rather than
 * waiting on that fallback. The *original* 401 is still surfaced to the
 * caller rather than the internal refresh failure — that's the error the
 * page's own error state was already built to show.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await rawRequest<T>(path, options);
  } catch (err) {
    const authHeader = (options.headers as Record<string, string> | undefined)?.Authorization;
    const canRetryWithRefresh =
      err instanceof ApiError &&
      err.status === 401 &&
      !options.isRetryAttempt &&
      typeof authHeader === "string" &&
      path !== "/accounts/refresh";

    if (!canRetryWithRefresh) throw err;

    try {
      const tokens = await refreshTokens();
      useAuthStore.getState().setTokens(tokens);
      return await rawRequest<T>(path, {
        ...options,
        isRetryAttempt: true,
        headers: { ...options.headers, Authorization: `Bearer ${tokens.accessToken}` },
      });
    } catch {
      useAuthStore.getState().logOut();
      void router.navigate("/login");
      throw err;
    }
  }
}
