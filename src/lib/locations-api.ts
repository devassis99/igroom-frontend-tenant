import { request } from "./http";

/**
 * Talks to igroom-backend's /locations module (see locations.service.ts) —
 * T12d's Locations settings page (list/add/edit) plus the location picker
 * on Staff Management's Add/Edit Member flows. Every route requires a
 * bearer token — requireAccountAuth derives accountId server-side, same
 * pattern as services-api.ts/staff-api.ts.
 */

export interface AccountLocation {
  id: string;
  accountId: string;
  name: string;
  address: string;
  phone: string | null;
  timezone: string | null;
  /** Set via the Locations settings page's map picker — see AddEditLocationModal.tsx/LocationMapPicker.tsx. Both null until an owner drops a pin. */
  latitude: number | null;
  longitude: number | null;
  status: "active" | "inactive";
  isPrimary: boolean;
  /** Active staff currently assigned to this location. */
  staffCount: number;
  /**
   * Whether this branch is one the caller runs.
   *
   * False for a shop outside their reach — the row still appears, because
   * the member picker has to offer every branch, but the trading figures
   * below come back null rather than zeroed. Zero is a claim about a real
   * day's takings; null says "not yours to see".
   */
  inScope: boolean;
  /** Non-cancelled bookings starting today (server UTC day). Null for a branch outside the caller's reach. */
  bookingsToday: number | null;
  /** Sum of priceCents across today's non-cancelled bookings. Null outside the caller's reach. */
  revenueTodayCents: number | null;
  /** A few staff for the row's avatar stack — `staffCount` is still the real total. */
  staffPreview: { id: string; name: string }[];
  /** Takings per day for the last 7 days, oldest first, zero-filled so the sparkline has a bar per day. Null outside the caller's reach. */
  revenueSeries: { date: string; cents: number }[] | null;
  /** Half-hour slots booked today. Null outside the caller's reach. */
  slotsBooked: number | null;
  /** Half-hour slots the roster's working hours actually offer today. Zero means nobody has hours set; null means this branch is outside the caller's reach. */
  slotsCapacity: number | null;
  /** No staff, or none with hours — this location can't take a booking yet. */
  needsSetup: boolean;
  createdAt: string;
}

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

/** T12d's location cards, each with today's live stats. Also backs the location picker on Add/Edit Member. */
export function listLocations(accessToken: string): Promise<{ locations: AccountLocation[] }> {
  return request("/locations", { headers: authHeaders(accessToken) });
}

export interface LocationInput {
  name: string;
  address: string;
  phone?: string | null;
  timezone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

/** T12d's "+ Add Location". New locations are never primary — only the one created at signup is. */
export function createLocation(
  accessToken: string,
  input: LocationInput,
): Promise<{ location: AccountLocation }> {
  return request("/locations", { method: "POST", body: input, headers: authHeaders(accessToken) });
}

export interface LocationUpdateInput extends Partial<LocationInput> {
  /** Toggling a location Active/Inactive is just a PATCH through this same route — the primary location can't be set inactive (see locations.service.ts). */
  status?: "active" | "inactive";
}

export function updateLocation(
  accessToken: string,
  locationId: string,
  patch: LocationUpdateInput,
): Promise<{ location: AccountLocation }> {
  return request(`/locations/${locationId}`, {
    method: "PATCH",
    body: patch,
    headers: authHeaders(accessToken),
  });
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

export interface PlaceSuggestion {
  /** Mapbox's opaque id — only resolvable within the same session token that produced it. */
  id: string;
  displayName: string;
}

/**
 * Type-ahead place search, proxied through igroom-backend (which holds
 * the Mapbox token). Two steps: this returns candidates without
 * coordinates, then retrievePlace resolves the chosen one — both sharing
 * a `sessionToken` so Mapbox bills the whole type-ahead once rather than
 * per keystroke.
 *
 * `proximity` biases results toward wherever the map already is; without
 * it, searching "lahore" ranks a village in Ireland alongside the city.
 */
export function searchPlaces(
  accessToken: string,
  query: string,
  sessionToken: string,
  proximity?: { latitude: number; longitude: number },
): Promise<{ results: PlaceSuggestion[] }> {
  const params = new URLSearchParams({ q: query, sessionToken });
  if (proximity) {
    params.set("proximity", `${proximity.latitude},${proximity.longitude}`);
  }
  return request(`/locations/geocode?${params.toString()}`, { headers: authHeaders(accessToken) });
}

/** Step two — resolves a chosen suggestion to coordinates. Must reuse the session token the suggestions came from. */
export function retrievePlace(
  accessToken: string,
  id: string,
  sessionToken: string,
): Promise<GeocodeResult> {
  const params = new URLSearchParams({ id, sessionToken });
  return request(`/locations/geocode/retrieve?${params.toString()}`, {
    headers: authHeaders(accessToken),
  });
}

/** The other direction of geocodeLocation above — dropping/dragging the map pin calls this to fill the ADDRESS field back in, so the two stay in sync no matter which one the owner touches first. */
export function reverseGeocodeLocation(
  accessToken: string,
  latitude: number,
  longitude: number,
): Promise<{ displayName: string }> {
  const params = new URLSearchParams({ lat: String(latitude), lng: String(longitude) });
  return request(`/locations/reverse-geocode?${params.toString()}`, {
    headers: authHeaders(accessToken),
  });
}

// --- The location detail pane's tabs ---------------------------------------

export interface LocationStaffMember {
  id: string;
  name: string;
  email: string;
  displayTitle: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  /**
   * False until this member has signed in at least once — an unclaimed
   * invite. Distinct from isActive, which is true from the moment the
   * invite is created, so it does NOT tell an invite apart from a working
   * member.
   */
  claimed: boolean;
  roleName: string | null;
  /** False means nobody can book them here yet — no working hours set. */
  hasHours: boolean;
}

export function listLocationStaff(
  accessToken: string,
  locationId: string,
): Promise<{ staff: LocationStaffMember[] }> {
  return request(`/locations/${locationId}/staff`, { headers: authHeaders(accessToken) });
}

export interface LocationPayment {
  bookingId: string;
  startAt: string;
  customerName: string;
  serviceName: string;
  type: "full" | "deposit" | null;
  status: "requires_payment" | "paid" | "failed" | "refunded" | null;
  capturedCents: number;
  remainingCents: number;
}

/**
 * Money that has actually moved at this location. Transfers to the shop's
 * own bank aren't modelled anywhere in the backend, so this is takings and
 * what's still owed — not a payout schedule. See getLocationPayouts.
 */
export interface LocationPayouts {
  windowDays: number;
  totals: {
    bookedCents: number;
    capturedCents: number;
    refundedCents: number;
    outstandingCents: number;
  };
  payments: LocationPayment[];
}

export function getLocationPayouts(
  accessToken: string,
  locationId: string,
): Promise<LocationPayouts> {
  return request(`/locations/${locationId}/payouts`, { headers: authHeaders(accessToken) });
}

/** One row of the Services & pricing tab — every catalogue service, ticked or not. */
export interface LocationCatalogueEntry {
  serviceId: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  isEnabled: boolean;
  offered: boolean;
  cataloguePriceCents: number;
  catalogueDurationMinutes: number;
  priceCentsOverride: number | null;
  durationMinutesOverride: number | null;
  /** Resolved: the override if set, otherwise the catalogue's figure. */
  priceCents: number;
  durationMinutes: number;
}

export function listLocationServices(
  accessToken: string,
  locationId: string,
): Promise<{ services: LocationCatalogueEntry[] }> {
  return request(`/locations/${locationId}/services`, { headers: authHeaders(accessToken) });
}

export interface LocationServiceInput {
  serviceId: string;
  priceCents?: number | null;
  durationMinutes?: number | null;
}

/** The complete set of services this location offers — same whole-set replace as setServiceLocations. */
export function setLocationServices(
  accessToken: string,
  locationId: string,
  services: LocationServiceInput[],
): Promise<{ services: LocationCatalogueEntry[] }> {
  return request(`/locations/${locationId}/services`, {
    method: "PUT",
    body: { services },
    headers: authHeaders(accessToken),
  });
}
