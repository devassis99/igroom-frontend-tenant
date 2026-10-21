import { type ReactNode } from "react";
import { NavLink, Outlet } from "react-router";
import { usePermissions } from "@/auth/use-permissions";

type NavIconComponent = (props: { className?: string }) => ReactNode;

interface SettingsNavItem {
  to: string;
  label: string;
  icon: NavIconComponent;
  end?: boolean;
  badge?: string;
  /**
   * staff_permissions.key needed to see this row. Omitted means everyone
   * signed in gets it — Business Profile, Availability and Security are
   * the caller's own settings, not account-wide ones, and Integrations
   * has no backend to gate against yet. Kept in sync with
   * auth/route-permissions.ts, which gates the route itself.
   */
  permission?: string;
}

const GENERAL_ITEMS: SettingsNavItem[] = [
  { to: "/settings", label: "Business Profile", icon: BusinessProfileIcon, end: true },
  { to: "/settings/hours", label: "Availability", icon: AvailabilityIcon },
  { to: "/settings/security", label: "Security", icon: SecurityIcon },
];

const WORKSPACE_ITEMS: SettingsNavItem[] = [
  {
    to: "/settings/staff",
    label: "Staff Management",
    icon: StaffIcon,
    permission: "staff.view",
  },
  {
    to: "/settings/integrations",
    label: "Integrations",
    icon: IntegrationsIcon,
    badge: "BUSINESS",
  },
  {
    to: "/settings/billing",
    label: "Billing & Plan",
    icon: BillingIcon,
    permission: "billing.view",
  },
];

// Same outline-glyph family (24x24 viewBox, 1.75 stroke, round caps/joins,
// currentColor) as AppShell.tsx's root nav icons, so the Settings sidebar
// reads as a continuation of that nav rather than a differently-styled
// sub-section — see this file's earlier emoji icons, which the user asked
// to swap out for "like main root menu".
const ICON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

function BusinessProfileIcon({ className = "" }: { className?: string }) {
  return (
    <svg {...ICON_PROPS} className={className}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function AvailabilityIcon({ className = "" }: { className?: string }) {
  return (
    <svg {...ICON_PROPS} className={className}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14.5" />
    </svg>
  );
}

function SecurityIcon({ className = "" }: { className?: string }) {
  return (
    <svg {...ICON_PROPS} className={className}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

/** Two-person glyph for Staff Management, matching AppShell.tsx's root Staff nav row. */
function StaffIcon({ className = "" }: { className?: string }) {
  return (
    <svg {...ICON_PROPS} className={className}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

/** 2x2 app-grid glyph, matching AppShell.tsx's root Integrations row. */
function IntegrationsIcon({ className = "" }: { className?: string }) {
  return (
    <svg {...ICON_PROPS} className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function BillingIcon({ className = "" }: { className?: string }) {
  return (
    <svg {...ICON_PROPS} className={className}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}

// Selected row in the logo's clay (a light clay tint, deeper clay text)
// rather than the old blue — trying the brand colour here first, before
// deciding whether the main sidebar's selection should follow.
function navClass(isActive: boolean) {
  return `flex items-center gap-2.5 rounded-lg px-4 py-2.5 font-sans text-[14px] transition-colors duration-150 ${
    isActive
      ? "bg-brand-clay/10 font-semibold text-brand-clay-deep"
      : // Half-strength hover, as in AppShell's main menu: on white, the full
        // tn-page tint would read stronger than the clay selection.
        "font-medium text-tn-nav-inactive hover:bg-tn-page/60 hover:text-tn-ink-soft"
  }`;
}

/**
 * Matches the mockup's T12 Settings frame's left nav — shared by every
 * T12* sub-page. The mockup draws this as a second, full-height sidebar
 * flush against AppShell's main nav (same background, no card/border),
 * not a card floating inside the page's normal content padding. AppShell
 * applies that padding uniformly to every route's content
 * (px-10, pt-8 pb-24 on the Outlet wrapper), so the only way for this one route
 * to visually escape it is to cancel it back out here with matching
 * negative margins, then let the two inner columns re-apply their own
 * padding independently — the nav's for its own inset content, the
 * content column's to keep every T12* sub-page visually unchanged.
 *
 * This nav used to be collapsible, for the Locations page's detail pane.
 * Locations is a root-nav route now (/locations) and collapses AppShell's
 * own rail through useAppChrome instead, so nothing was left asking this
 * one to shrink.
 *
 * Pure white, the same as AppShell's main menu, so the two read as one
 * family of menus. (The mockup gave this nav its own table-header shade;
 * that changed when the main menu went white.) The border on each keeps
 * a visible seam between "app nav" and "settings nav".
 *
 * The nav stays put while the page beside it scrolls, like the main
 * menu. This layout is exactly one screen tall and cancels all of
 * AppShell's content padding (top, right and the pb-24 bottom), so
 * AppShell's own scroll area has nothing to scroll; the content column
 * is the scroller instead, and the nav never moves. That beat
 * `position: sticky` on the nav inside AppShell's scroller: sticky
 * measures from inside the scroller's padding, so the nav sat 32px down
 * from the top until the last stretch of a long page — fixable with a
 * negative offset, but only in browsers that measure it that way. The
 * column puts the padding back (pr-10 to keep its scrollbar at the
 * window's edge, pb-24 so a page's last control still clears the help
 * button). Every page here remounts with its route, so each one opens
 * scrolled to the top.
 */
export function SettingsLayout() {
  const { has } = usePermissions();
  const visible = (items: SettingsNavItem[]) =>
    items.filter((item) => !item.permission || has(item.permission));

  const generalItems = visible(GENERAL_ITEMS);
  const workspaceItems = visible(WORKSPACE_ITEMS);

  return (
    <div className="-mt-8 -mr-10 -mb-24 flex h-screen">
      <nav
        data-tour="settings-nav"
        className="-ml-10 flex w-[240px] flex-none flex-col gap-6 overflow-y-auto border-r border-tn-border bg-white py-8"
      >
        <p className="m-0 px-4 font-sans text-[20px] font-semibold text-tn-ink">Settings</p>
        <div>
          <p className="m-0 mb-2 px-4 font-sans text-[12px] font-semibold tracking-[0.04em] text-tn-faint">
            GENERAL
          </p>
          <div className="flex flex-col gap-0.5">
            {generalItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => navClass(isActive)}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>

        {workspaceItems.length > 0 && (
          <div>
            <p className="m-0 mb-2 px-4 font-sans text-[12px] font-semibold tracking-[0.04em] text-tn-faint">
              WORKSPACE SETTINGS
            </p>
            <div className="flex flex-col gap-0.5">
              {workspaceItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => navClass(isActive)}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="rounded-full bg-tn-gold-bg px-1.5 py-0.5 font-sans text-[11px] font-semibold text-tn-gold">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="min-w-0 flex-1 overflow-y-auto pt-8 pr-10 pb-24 pl-10">
        <Outlet />
      </div>
    </div>
  );
}

export default SettingsLayout;
