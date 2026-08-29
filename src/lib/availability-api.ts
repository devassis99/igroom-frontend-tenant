import { request } from "./http";
import type { Collision } from "./collisions-api";

/**
 * Talks to igroom-backend's /availability module (see
 * availability.service.ts). dayOfWeek is 0 = Sunday .. 6 = Saturday,
 * matching JS Date#getDay(), so the tenant frontend never has to remap
 * it.
 *
 * A schedule belongs to a shop, not to a person: the same member holds
 * one week per location they work at, each written in that location's
 * own timezone. A read returns all of them at once (the editor's tab
 * strip is that list, and its cross-shop note needs the other shops'
 * hours to convert); a write names the one shop it applies to and
 * leaves the rest alone.
 *
 * Every route has an "/me" shorthand (always the caller's own schedule)
 * and a "/staff/:staffUserId" form (self, or anyone else if the caller
 * has staff.manage) — both return/accept the exact same shapes below, so
 * one set of functions here covers both; pass your own id to the
 * staff-scoped functions to act on yourself.
 */

export interface AvailabilityRange {
  /** Present on anything read back from the API; omit when building a range to submit via setStaffAvailability. */
  id?: string;
  startTime: string;
  endTime: string;
}

export interface AvailabilityDay {
  dayOfWeek: number;
  /** Empty array means this day is off — no separate on/off flag. */
  ranges: AvailabilityRange[];
}

export interface AvailabilityOverride {
  id: string;
  /** "YYYY-MM-DD" */
  date: string;
  isUnavailable: boolean;
  startTime: string | null;
  endTime: string | null;
}

/** The shop a schedule belongs to. `timezone` is the clock its times are written in — null means the backend reads it as UTC. */
export interface ScheduleLocation {
  id: string;
  name: string;
  timezone: string | null;
}

/** One shop's week and that shop's date overrides. */
export interface LocationSchedule {
  location: ScheduleLocation;
  weeklySchedule: AvailabilityDay[];
  overrides: AvailabilityOverride[];
}

export interface AvailabilityResponse {
  /** One entry per shop the member works at, ordered by shop name. Empty when they're on no roster at all. */
  schedules: LocationSchedule[];
}

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

export function getStaffAvailability(
  accessToken: string,
  staffUserId: string,
): Promise<AvailabilityResponse> {
  return request(`/availability/staff/${staffUserId}`, { headers: authHeaders(accessToken) });
}

/**
 * Replaces the target staff member's whole week *at one shop* in one
 * call — always send all 7 days. Their weeks at other shops are
 * untouched. Times are wall-clock in that shop's own timezone.
 *
 * `locationId` may be omitted only when the member works at exactly one
 * shop (the backend resolves it then, and errors rather than guessing
 * otherwise) — which is what the signup flow relies on, since it submits
 * before it has ever fetched a location id.
 */
export function setStaffAvailability(
  accessToken: string,
  staffUserId: string,
  locationId: string | undefined,
  days: AvailabilityDay[],
  /**
   * Re-submit with true to save hours that leave less than the account's
   * travel buffer between two shops. It reaches only the *travel* half of
   * the collision guard — an overlap is refused however many times it is
   * sent, because nothing a manager knows makes one person bookable in
   * two rooms at once. See lib/collisions-api.ts.
   */
  acceptTravelWarning = false,
): Promise<{ locationId: string; weeklySchedule: AvailabilityDay[]; warnings: Collision[] }> {
  return request(`/availability/staff/${staffUserId}`, {
    method: "PUT",
    headers: authHeaders(accessToken),
    body: { locationId, days, acceptTravelWarning },
  });
}

export interface UpsertOverrideInput {
  date: string;
  isUnavailable: boolean;
  startTime?: string;
  endTime?: string;
}

/**
 * Add (or replace, if that shop already has one for the date) a
 * date-specific override. Scoped to a shop like the week is, so a day
 * off everywhere is one call per shop.
 */
export function addStaffOverride(
  accessToken: string,
  staffUserId: string,
  locationId: string | undefined,
  input: UpsertOverrideInput,
): Promise<{ override: AvailabilityOverride }> {
  return request(`/availability/staff/${staffUserId}/overrides`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: { locationId, ...input },
  });
}

/** Overrides carry their own shop, so removing one doesn't restate it. */
export function removeStaffOverride(
  accessToken: string,
  staffUserId: string,
  overrideId: string,
): Promise<void> {
  return request(`/availability/staff/${staffUserId}/overrides/${overrideId}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
}

/**
 * Convenience wrappers for "my own schedule", used by
 * StaffAvailabilityPage's onboarding step (before a full staffUser
 * profile is even loaded client-side, so there's no id in hand yet to
 * pass to the staff-scoped functions above) and ReceiptPage's post-signup
 * submit. Neither names a location: at that point the account has
 * exactly one, which is the single case the backend will resolve for
 * itself.
 */
export function getMyAvailability(accessToken: string): Promise<AvailabilityResponse> {
  return request("/availability/me", { headers: authHeaders(accessToken) });
}

export function setMyAvailability(
  accessToken: string,
  days: AvailabilityDay[],
): Promise<{ locationId: string; weeklySchedule: AvailabilityDay[]; warnings: Collision[] }> {
  return request("/availability/me", {
    method: "PUT",
    headers: authHeaders(accessToken),
    body: { days },
  });
}
