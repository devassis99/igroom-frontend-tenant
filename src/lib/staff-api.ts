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
 * every response the same way location names are.
 *
 * A member works at *many* locations (`locations` below, plural), and
 * their service assignments are per-location — "Ali does beard trims" is
 * only true at the shops that offer beard trims and that he actually
 * works at. See the backend's db/schema/staff-locations.ts.
 */

/** One shop a member works at. Name denormalized so a table never needs a second round trip to label a row. */
export interface StaffMemberLocation {
  id: string;
  name: string;
}

/** Assigned service ids keyed by the location the assignment applies at. A location with nothing ticked is simply absent. */
export type ServiceIdsByLocation = Record<string, string[]>;

export interface StaffMember {
  id: string;
  accountId: string;
  /** Every shop this member works at, ordered by name. Always at least one. */
  locations: StaffMemberLocation[];
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
  /** Services this member can perform, per location. Always an object — the backend maps "nothing assigned" to {}. */
  serviceIdsByLocation: ServiceIdsByLocation;
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
  /**
   * The one shop this member starts at. Additional locations are added
   * later from Edit Member — hiring happens somewhere, and working a
   * second site is a separate decision.
   */
  locationId: string;
  /** The wizard's Services step. Keyed by location, though only the invite location can appear. */
  serviceIdsByLocation?: ServiceIdsByLocation;
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
): Promise<{ staff: StaffMember; invite: StaffInviteResult }> {
  return request("/staff", { method: "POST", body: input, headers: authHeaders(accessToken) });
}

export interface StaffUpdateInput {
  name?: string;
  roleId?: string;
  /**
   * Complete replacement set of the shops this member works at. Omitting
   * leaves them alone. Every id must book in the same timezone — a member
   * has one weekly schedule, and it can only describe one working day.
   */
  locationIds?: string[];
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
   * up assigned, keyed by the location it applies at. Omitting leaves
   * assignments untouched; {} clears them. Taking a member off a location
   * drops that location's assignments even without this, since a service
   * assigned at a shop they've left can't be displayed or undone.
   */
  serviceIdsByLocation?: ServiceIdsByLocation;
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

export interface StaffInviteResult {
  /** True only when a real provider actually accepted it. False for both a failed send and the dev console fallback. */
  emailed: boolean;
  /**
   * Which of the three things happened. "logged" means no email provider
   * is configured, so the message was printed to the server console
   * instead — the invite is valid, it just hasn't left the machine.
   */
  delivery: "sent" | "logged" | "failed";
  /** ISO timestamp — 7 days out. */
  expiresAt: string;
}

/**
 * Re-mints and re-sends the setup link for a member who hasn't claimed
 * their account yet. Supersedes any outstanding invite for them, so an
 * older forwarded email stops working immediately.
 */
export function resendStaffInvite(
  accessToken: string,
  staffId: string,
): Promise<{ invite: StaffInviteResult }> {
  return request(`/staff/${staffId}/invite/resend`, {
    method: "POST",
    headers: authHeaders(accessToken),
  });
}

/**
 * A setup link to hand over by some other means, for when email won't do
 * the job.
 *
 * Mints a new one rather than reading the existing link back — the
 * server only ever stores the token's hash, so no link can be looked up
 * after it is issued. Taking one therefore supersedes whatever was
 * emailed, which the UI has to say out loud rather than leave the owner
 * to discover.
 *
 * Sends no email. The returned URL is a credential: anyone holding it
 * can claim that member's account until it is superseded or expires.
 */
export function createStaffInviteLink(
  accessToken: string,
  staffId: string,
): Promise<{ invite: { url: string; expiresAt: string } }> {
  return request(`/staff/${staffId}/invite/link`, {
    method: "POST",
    headers: authHeaders(accessToken),
  });
}
