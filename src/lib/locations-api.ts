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
  status: "active" | "inactive";
  isPrimary: boolean;
  /** Active staff currently assigned to this location. */
  staffCount: number;
  /** Non-cancelled bookings starting today (server UTC day). */
  bookingsToday: number;
  /** Sum of priceCents across today's non-cancelled bookings. */
  revenueTodayCents: number;
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
