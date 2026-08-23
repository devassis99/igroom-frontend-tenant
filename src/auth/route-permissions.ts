/**
 * Which staff permission a route needs, in one place.
 *
 * Both navs (AppShell's root sidebar and SettingsLayout's settings
 * sidebar) filter their items through this, and AppShell gates the route
 * itself with the same map — so a hidden menu item and a blocked page can
 * never disagree, and typing the URL directly doesn't get you a page the
 * menu wouldn't offer.
 *
 * Every key here mirrors the `requireAccountPermission(...)` guard on the
 * endpoint the page actually calls, so the menu tells the truth about
 * what will work rather than guessing. Pages with no entry are ungated on
 * purpose:
 *
 * - **Home** is the landing page — everyone who can log in gets it, and
 *   gating it would leave some roles with nowhere to land.
 * - **Business Profile** and **Security** are the caller's own settings,
 *   not account-wide ones. Security only ever edits your own password and
 *   2FA; the backend scopes both to `req.staffUser` with no permission
 *   check at all.
 * - **Availability** (`/availability/me`) is likewise your own schedule.
 *   That page *also* shows a staff picker for editing someone else's,
 *   but it already hides that itself behind `staff.view` — the page is
 *   still useful without it.
 * - **Integrations** has no backend yet, so there's no guard to mirror.
 *
 * Three entries are judgement calls rather than mirrors, because the
 * pages behind them still render sample data and so have no endpoint to
 * mirror yet. Waitlist and Analytics take `bookings.view` (walk-ins are
 * bookings; the analytics figures are appointment-derived) and Payments
 * takes `billing.view`. Analytics is the shakiest of the three: it shows
 * revenue, and the seeded Receptionist role is described as having "no
 * financial access" while still holding `bookings.view`. A dedicated
 * `analytics.view` permission is the real fix — worth adding when that
 * page gets wired to a real endpoint.
 */
export interface GatedRoute {
  /** Route path prefix. A pathname matches it exactly, or as a sub-route (`/settings/staff/roles`). */
  to: string;
  /** staff_permissions.key the caller must hold — see igroom-backend's DEFAULT_PERMISSIONS. */
  permission: string;
}

export const ROUTE_PERMISSIONS: GatedRoute[] = [
  { to: "/calendar", permission: "bookings.view" },
  { to: "/waitlist", permission: "bookings.view" },
  { to: "/analytics", permission: "bookings.view" },
  { to: "/services", permission: "services.view" },
  { to: "/staff", permission: "staff.view" },
  { to: "/customers", permission: "customers.view" },
  { to: "/payments", permission: "billing.view" },
  { to: "/settings/locations", permission: "locations.view" },
  { to: "/settings/staff", permission: "staff.view" },
  { to: "/settings/billing", permission: "billing.view" },
];

/** Exact match, or a sub-route of it. `/settings/staff` deliberately does NOT match `/staff`. */
function matchesRoute(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}

/**
 * The permission `pathname` needs, or null if it's open to anyone signed
 * in. Longest match wins so a specific entry beats a broader one that
 * shares its prefix — matters the moment someone adds `/settings` itself
 * to the list above.
 */
export function requiredPermissionFor(pathname: string): string | null {
  let best: GatedRoute | null = null;
  for (const entry of ROUTE_PERMISSIONS) {
    if (matchesRoute(pathname, entry.to) && (!best || entry.to.length > best.to.length)) {
      best = entry;
    }
  }
  return best?.permission ?? null;
}
