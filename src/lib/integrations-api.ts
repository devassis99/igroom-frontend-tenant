import { request } from "./http";

/**
 * Talks to igroom-backend's /integrations module.
 *
 * The page this backs used to be sample data — a grid of cards with a
 * hardcoded "Connected: 4" and nothing behind any of them. The catalogue
 * is still worth showing (it says what iGroom is heading towards), but
 * anything claiming to be connected now has to prove it.
 */

/** What a provider belongs to. Declared by the backend's registry, never guessed here. */
export type IntegrationScope = "account" | "staff";

export type IntegrationProvider = "google_calendar" | "whatsapp_business";

export interface Integration {
  id: string;
  provider: IntegrationProvider;
  scope: IntegrationScope;
  label: string;
  blurb: string;
  /** False for a provider that exists in the registry but isn't built yet. */
  available: boolean;
  status: "connected" | "needs_reauth" | "revoked" | "not_connected";
  /** Which Google account, so somebody with three of them can tell. */
  connectedAs: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  /** How many slices of time this connection is currently blocking — the only honest proof it does anything. */
  blockedCount: number;
}

export const integrationKeys = {
  all: ["integrations"] as const,
};

/**
 * Every call here takes the access token explicitly, the same way
 * locations-api.ts and staff-api.ts do.
 *
 * `request()` does not attach one on its own — it only *reads* the
 * Authorization header a caller set, to decide whether a 401 is worth
 * retrying after a refresh. Omitting it doesn't fail loudly at the call
 * site; it produces a plain "Missing bearer token" 401, which is exactly
 * what this module did on its first outing.
 */
function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

export async function listIntegrations(accessToken: string): Promise<Integration[]> {
  const body = await request<{ integrations: Integration[] }>("/integrations", {
    headers: authHeaders(accessToken),
  });
  return body.integrations;
}

/**
 * Asks the API where to send the barber, then the caller navigates.
 *
 * A full page navigation rather than a popup: Google's consent screen
 * refuses to run in an iframe and popups get blocked, and the barber has
 * to come back to *this* app afterwards anyway — `returnTo` is the path
 * the callback redirects to, resolved against the tenant app's own origin
 * on the server side.
 */
export async function googleCalendarConnectUrl(
  accessToken: string,
  returnTo: string,
): Promise<string> {
  const body = await request<{ url: string }>(
    `/integrations/google-calendar/connect?returnTo=${encodeURIComponent(returnTo)}`,
    { headers: authHeaders(accessToken) },
  );
  return body.url;
}

export async function syncIntegration(accessToken: string, integrationId: string): Promise<number> {
  const body = await request<{ blocked: number }>(`/integrations/${integrationId}/sync`, {
    method: "POST",
    headers: authHeaders(accessToken),
  });
  return body.blocked;
}

export async function disconnectIntegration(
  accessToken: string,
  provider: IntegrationProvider,
): Promise<void> {
  await request<void>(`/integrations/${provider}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
}

/**
 * External busy time for a branch's staff, over a window.
 *
 * Times only — never the event's title. A barber connected their personal
 * calendar so the shop would stop double-booking them, not so the front
 * desk could read what their Thursday appointment is for.
 */
export interface ExternalBusy {
  id: string;
  staffUserId: string;
  startAt: string;
  endAt: string;
  isAllDay: boolean;
}

export const externalBusyKeys = {
  range: (locationId: string, from: string, to: string) =>
    ["integrations-busy", locationId, from, to] as const,
};

export async function listExternalBusy(
  accessToken: string,
  locationId: string,
  from: string,
  to: string,
): Promise<ExternalBusy[]> {
  const query = new URLSearchParams({ locationId, from, to });
  const body = await request<{ busy: ExternalBusy[] }>(`/integrations/busy?${query.toString()}`, {
    headers: authHeaders(accessToken),
  });
  return body.busy;
}
