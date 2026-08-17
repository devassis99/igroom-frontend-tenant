import { request } from "./http";

/**
 * Talks to igroom-backend's /staff module (see staff.service.ts) — the
 * T12g Staff Management table plus the T12h–l "Add New Member" flow's
 * Profile/Role steps. Every route requires a bearer token — requireAccountAuth
 * derives accountId from it server-side, same pattern as services-api.ts,
 * except staff spans every location on the account, not just the caller's own.
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
}

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

/** T12g's full roster, every location on the account. */
export function listStaff(accessToken: string): Promise<{ staff: StaffMember[] }> {
  return request("/staff", { headers: authHeaders(accessToken) });
}

export interface InviteStaffInput {
  name: string;
  email: string;
  roleId: string;
  locationId: string;
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
}

/** The T12g ✎ "opens the profile edit" affordance — name, role, and which location this member is scoped to. */
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
