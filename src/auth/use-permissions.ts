import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "./auth-store";
import { getMe } from "@/lib/accounts-api";

/**
 * The caller's current permission keys (staff-roles.service.ts's
 * getStaffRolePermissionKeys, surfaced via GET /accounts/me) — used to
 * gate management UI (the "+ New Member" button, role editing, the Roles
 * & Permissions page itself) the same way requireAccountPermission gates
 * the matching endpoint server-side, and to decide which nav items and
 * routes exist at all (see auth/route-permissions.ts).
 *
 * This is UX only — hiding a button or a menu row here doesn't stop a
 * direct API call; the backend's requireAccountPermission is the real
 * enforcement boundary regardless of what this hook returns.
 *
 * Answers come from two places on purpose. The query is the source of
 * truth, cached for a minute so every settings sub-page mounting this
 * doesn't re-fetch /accounts/me on every navigation. But it's *async*,
 * and once the nav is built from permissions, waiting on it would mean
 * every hard page load flashes a sidebar with half its items missing and
 * then pops the rest in. So each result is also mirrored into the auth
 * store, which persists — a reload renders the right nav on the first
 * frame from the last known answer, and the query silently corrects it a
 * moment later if a role changed in the meantime. Worst case is one
 * frame of a stale menu row that 403s when clicked, which is exactly what
 * the server-side check is there for.
 *
 * Invalidate ["me", "permissions"] if a role's own permissions change
 * while the user is looking at it.
 */
export function usePermissions() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const cached = useAuthStore((s) => s.permissions);
  const setPermissions = useAuthStore((s) => s.setPermissions);

  const query = useQuery({
    queryKey: ["me", "permissions"],
    queryFn: () => getMe(accessToken ?? ""),
    enabled: !!accessToken,
    staleTime: 60_000,
  });

  const fetched = query.data?.permissions;

  useEffect(() => {
    if (fetched) setPermissions(fetched);
  }, [fetched, setPermissions]);

  const permissions = fetched ?? cached;

  return {
    permissions,
    has: (key: string) => permissions.includes(key),
    isLoading: query.isPending,
    /**
     * Whether `permissions` can be trusted to be complete. False only on
     * a first-ever load with nothing cached — the one case where a route
     * guard should wait rather than deny, since "no permissions yet" and
     * "genuinely no permission" look identical from here.
     */
    isReady: !query.isPending || cached.length > 0,
    /** The caller's own staff_users row (id, locationId, roleId, ...) — e.g. Settings > Availability defaults its staff picker to this id. Null until this query resolves. */
    staffUser: query.data?.staffUser ?? null,
    /** The account row this session belongs to — read for account-wide settings such as the collision guard's travel buffer. Null until this query resolves. */
    account: query.data?.account ?? null,
  };
}
