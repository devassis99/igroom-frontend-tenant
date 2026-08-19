import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "./auth-store";
import { getMe } from "@/lib/accounts-api";

/**
 * The caller's current permission keys (staff-roles.service.ts's
 * getStaffRolePermissionKeys, surfaced via GET /accounts/me) — used to
 * gate management UI (the "+ New Member" button, role editing, the Roles
 * & Permissions page itself) the same way requireAccountPermission gates
 * the matching endpoint server-side.
 *
 * This is UX only — hiding a button here doesn't stop a direct API call,
 * the backend's requireAccountPermission is the real enforcement
 * boundary regardless of what this hook returns. Cached for a minute so
 * every settings sub-page mounting this doesn't re-fetch /accounts/me on
 * every navigation; invalidate ["me", "permissions"] if a role's own
 * permissions change while the user is looking at it.
 */
export function usePermissions() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const query = useQuery({
    queryKey: ["me", "permissions"],
    queryFn: () => getMe(accessToken ?? ""),
    enabled: !!accessToken,
    staleTime: 60_000,
  });
  const permissions = query.data?.permissions ?? [];

  return {
    permissions,
    has: (key: string) => permissions.includes(key),
    isLoading: query.isPending,
    /** The caller's own staff_users row (id, locationId, roleId, ...) — e.g. Settings > Availability defaults its staff picker to this id. Null until this query resolves. */
    staffUser: query.data?.staffUser ?? null,
  };
}
