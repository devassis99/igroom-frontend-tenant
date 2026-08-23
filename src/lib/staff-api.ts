import { request } from "./http";

/**
 * Talks to igroom-backend's /staff module (see staff.service.ts) — the
 * T12g Staff Management table plus the T12h–l "Add New Member" flow's
 * Profile/Role steps, and now the T10 Staff performance page too (see
 * getStaffPerformance below). Every route requires a bearer token —
 * requireAccountAuth derives accountId from it server-side, same pattern
 * as services-api.ts, except staff spans every location on the account,
 * not just the caller's own.
 *
 * Roles are no longer a fixed 4-value enum — see roles-api.ts. A member's
 * role is just roleId (a staff_roles.id), with roleName denormalized onto
 * every response the same way locationName already was.
 */

export interface StaffMember {
  id: string;
  accountId: string;
  locationId: string;
  /** Denormalized so the table never needs a second round trip just to label a row. */
  locationName: string;
  name: string;
  email: string;
  roleId: string | null;
  /** Denormalized current name of roleId's staff_roles row — see roles-api.ts to manage the roles themselves. */
  roleName: string;
  isActive: boolean;
  /** False until this member has signed in at least once — see the Google-claim invite flow in staff.service.ts. Shown as "Invited" in the T12g STATUS column. */
  claimed: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  /** Percent, 0-100, or null if an owner hasn't set one yet — owner-entered via EditMemberModal, not computed. Feeds T10's Commission column. */
  commissionRate: number | null;
  /** 0.0-5.0, or null if an owner hasn't set one yet — there's no customer-review module to compute this from. Feeds T10's roster cards and Rating column. */
  rating: number | null;
  /** Customer-facing title ("Senior Barber") — distinct from roleName, which is the internal permission role. */
  displayTitle: string | null;
  bio: string | null;
  /** Short tag chips. Always an array — the backend maps a null column to []. */
  specialties: string[];
  yearsExperience: number | null;
  avatarUrl: string | null;
  /** Services this member can perform. Always an array; ids are services at this member's own location. */
  serviceIds: string[];
}

/** One StaffMember plus this-calendar-month performance, computed from real bookings/availability — see staff.service.ts's getStaffPerformance. Null fields mean "not enough data yet" (no saved schedule, no bookings, no commissionRate set), rendered as "—" rather than a misleading 0. */
export interface StaffPerformanceMember extends StaffMember {
  bookingsCount: number;
  hoursBooked: number;
  hoursAvailable: number | null;
  utilizationPct: number | null;
  salesCents: number;
  avgTicketCents: number | null;
  commissionCents: number | null;
}

export interface StaffPerformanceTeam {
  teamSalesCents: number;
  teamBookingsCount: number;
  avgTicketCents: number | null;
  avgUtilizationPct: number | null;
  commissionPayoutCents: number;
}

export interface StaffPerformanceResponse {
  staff: StaffPerformanceMember[];
  team: StaffPerformanceTeam;
}

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

/** T12g's full roster, every location on the account. */
export function listStaff(accessToken: string): Promise<{ staff: StaffMember[] }> {
  return request("/staff", { headers: authHeaders(accessToken) });
}

/** T10's Staff page — active staff members only, each with this month's real bookings/sales/utilization/commission. */
export function getStaffPerformance(accessToken: string): Promise<StaffPerformanceResponse> {
  return request("/staff/performance", { headers: authHeaders(accessToken) });
}

export interface InviteStaffInput {
  name: string;
  email: string;
  roleId: string;
  locationId: string;
  /** The wizard's Services step. Omit to assign nothing yet. */
  serviceIds?: string[];
}

/**
 * Pre-provisions a staff_users row with no password/Google identity bound
 * yet — the new member "claims" it themselves by signing in with Google
 * using this exact email on the Login page (already wired up, nothing new
 * needed there). No email actually gets sent; tell them out-of-band which
 * address to use, same limitation the back office's own invite flow has.
 */
export function inviteStaff(
  accessToken: string,
  input: InviteStaffInput,
): Promise<{ staff: StaffMember }> {
  return request("/staff", { method: "POST", body: input, headers: authHeaders(accessToken) });
}

export interface StaffUpdateInput {
  name?: string;
  roleId?: string;
  locationId?: string;
  /** Percent, 0-100, or null to clear a previously-set rate. */
  commissionRate?: number | null;
  /** 0.0-5.0, or null to clear a previously-set rating. */
  rating?: number | null;
  /** Marketplace Barber Profile fields. Null clears a value; omitting leaves it untouched. */
  displayTitle?: string | null;
  bio?: string | null;
  specialties?: string[] | null;
  yearsExperience?: number | null;
  avatarUrl?: string | null;
  /**
   * Complete replacement set, not a delta — send every id that should end
   * up assigned. Omitting leaves assignments untouched; [] clears them.
   * Changing locationId without sending this clears them too, since the
   * old ids belong to the previous location's menu.
   */
  serviceIds?: string[];
}

/** The T12g ✎ "opens the profile edit" affordance — name, role, location, plus (also used from T10's Staff page) commission rate and rating. */
export function updateStaff(
  accessToken: string,
  staffId: string,
  patch: StaffUpdateInput,
): Promise<{ staff: StaffMember }> {
  return request(`/staff/${staffId}`, {
    method: "PATCH",
    body: patch,
    headers: authHeaders(accessToken),
  });
}

export function setStaffActive(
  accessToken: string,
  staffId: string,
  isActive: boolean,
): Promise<{ staff: StaffMember }> {
  return request(`/staff/${staffId}/active`, {
    method: "PATCH",
    body: { isActive },
    headers: authHeaders(accessToken),
  });
}
