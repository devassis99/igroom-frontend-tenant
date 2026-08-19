import { request } from "./http";

/**
 * Talks to igroom-backend's /availability module (see
 * availability.service.ts). dayOfWeek is 0 = Sunday .. 6 = Saturday,
 * matching JS Date#getDay(), so the tenant frontend never has to remap
 * it.
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

export interface AvailabilityResponse {
  weeklySchedule: AvailabilityDay[];
  overrides: AvailabilityOverride[];
  /** This schedule's own IANA timezone if one's been set, independent of the staff member's location — null until explicitly picked (see HoursSettingsPage.tsx's fallback chain). */
  timezone: string | null;
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
 * Replaces the target staff member's entire weekly schedule in one call —
 * always send all 7 days. `timezone` follows the same "omit to leave
 * unchanged, null to clear" rule as the backend — HoursSettingsPage.tsx
 * always sends its current value, whatever that is, since the picker
 * there is always showing *something* (saved, or a fallback).
 */
export function setStaffAvailability(
  accessToken: string,
  staffUserId: string,
  days: AvailabilityDay[],
  timezone?: string | null,
): Promise<{ weeklySchedule: AvailabilityDay[]; timezone: string | null }> {
  return request(`/availability/staff/${staffUserId}`, {
    method: "PUT",
    headers: authHeaders(accessToken),
    body: { days, timezone },
  });
}

export interface UpsertOverrideInput {
  date: string;
  isUnavailable: boolean;
  startTime?: string;
  endTime?: string;
}

/** Add (or replace, if the date already has one) a date-specific override for the target staff member. */
export function addStaffOverride(
  accessToken: string,
  staffUserId: string,
  input: UpsertOverrideInput,
): Promise<{ override: AvailabilityOverride }> {
  return request(`/availability/staff/${staffUserId}/overrides`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: input,
  });
}

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
 * submit.
 */
export function getMyAvailability(accessToken: string): Promise<AvailabilityResponse> {
  return request("/availability/me", { headers: authHeaders(accessToken) });
}

export function setMyAvailability(
  accessToken: string,
  days: AvailabilityDay[],
): Promise<{ weeklySchedule: AvailabilityDay[]; timezone: string | null }> {
  return request("/availability/me", {
    method: "PUT",
    headers: authHeaders(accessToken),
    body: { days },
  });
}
