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
  /** Non-cancelled bookings starting today (server UTC day). */
  bookingsToday: number;
  /** Sum of priceCents across today's non-cancelled bookings. */
  revenueTodayCents: number;
  /** A few staff for the row's avatar stack — `staffCount` is still the real total. */
  staffPreview: { id: string; name: string }[];
  /** Takings per day for the last 7 days, oldest first, zero-filled so the sparkline has a bar per day. */
  revenueSeries: { date: string; cents: number }[];
  /** Half-hour slots booked today. */
  slotsBooked: number;
  /** Half-hour slots the roster's working hours actually offer today. Zero means nobody has hours set. */
  slotsCapacity: number;
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

/** Backs the map picker's "Locate from address" button — see locations.service.ts's geocodeAddress for why this goes through the backend instead of calling Nominatim straight from the browser. */
export function geocodeLocation(
  accessToken: string,
  query: string,
): Promise<{ results: GeocodeResult[] }> {
  const params = new URLSearchParams({ q: query });
  return request(`/locations/geocode?${params.toString()}`, { headers: authHeaders(accessToken) });
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
