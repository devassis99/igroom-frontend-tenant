import { request } from "./http";

/**
 * Talks to igroom-backend's /staff/roles module (see staff-roles.service.ts)
 * — the "Manage roles & permissions" screen linked from Staff Management.
 * Every route requires a bearer token, gated server-side by the caller's
 * own roles.view/roles.manage permission (requireAccountPermission) —
 * nothing here is a client-side-only guard, see use-permissions.ts.
 */

export interface StaffRoleDef {
  id: string;
  accountId: string;
  name: string;
  description: string | null;
  /** True only for the seeded "Owner" role — can't be renamed, re-permissioned, or deleted. */
  isSystem: boolean;
  permissions: string[];
  memberCount: number;
  createdAt: string;
}

export interface PermissionCatalogEntry {
  key: string;
  name: string;
  description: string | null;
}

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

export function listRoles(accessToken: string): Promise<{ roles: StaffRoleDef[] }> {
  return request("/staff/roles", { headers: authHeaders(accessToken) });
}

/** The global permission catalog (not account-scoped) — builds the create/edit-role checkbox matrix. */
export function listPermissionsCatalog(
  accessToken: string,
): Promise<{ permissions: PermissionCatalogEntry[] }> {
  return request("/staff/roles/permissions", { headers: authHeaders(accessToken) });
}

export interface CreateRoleInput {
  name: string;
  description?: string;
  permissionKeys: string[];
}

export function createRole(
  accessToken: string,
  input: CreateRoleInput,
): Promise<{ role: StaffRoleDef }> {
  return request("/staff/roles", {
    method: "POST",
    body: input,
    headers: authHeaders(accessToken),
  });
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
}

export function updateRole(
  accessToken: string,
  roleId: string,
  patch: UpdateRoleInput,
): Promise<{ role: StaffRoleDef }> {
  return request(`/staff/roles/${roleId}`, {
    method: "PATCH",
    body: patch,
    headers: authHeaders(accessToken),
  });
}

export function updateRolePermissions(
  accessToken: string,
  roleId: string,
  permissionKeys: string[],
): Promise<{ role: StaffRoleDef }> {
  return request(`/staff/roles/${roleId}/permissions`, {
    method: "PATCH",
    body: { permissionKeys },
    headers: authHeaders(accessToken),
  });
}

export function deleteRole(accessToken: string, roleId: string): Promise<void> {
  return request(`/staff/roles/${roleId}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
}
