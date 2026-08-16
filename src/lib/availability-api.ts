import { request } from "./http";

/**
 * Talks to igroom-backend's /availability module (see
 * availability.service.ts) — a staff member's own recurring weekly
 * schedule. dayOfWeek is 0 = Sunday .. 6 = Saturday, matching JS
 * Date#getDay(), so the tenant frontend never has to remap it.
 */
export interface AvailabilityDay {
  dayOfWeek: number;
  isEnabled: boolean;
  startTime?: string;
  endTime?: string;
}

export interface AvailabilityResponse {
  days: AvailabilityDay[];
}

/**
 * Replaces the caller's entire weekly schedule in one call — always send
 * all 7 days. Used by StaffAvailabilityPage's onboarding step; the
 * accessToken comes from auth-store since this call happens mid-signup,
 * right after loginWithSession has already set the real session.
 */
export function setMyAvailability(
  accessToken: string,
  days: AvailabilityDay[],
): Promise<AvailabilityResponse> {
  return request<AvailabilityResponse>("/availability/me", {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: { days },
  });
}

export function getMyAvailability(accessToken: string): Promise<AvailabilityResponse> {
  return request<AvailabilityResponse>("/availability/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
