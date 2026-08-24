import { useState, type ReactNode } from "react";
import { NavLink, Outlet, useOutletContext } from "react-router";
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
    to: "/settings/locations",
    label: "Locations",
    icon: LocationsIcon,
    permission: "locations.view",
  },
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

function LocationsIcon({ className = "" }: { className?: string }) {
  return (
    <svg {...ICON_PROPS} className={className}>
      <path d="M12 21s7-7.58 7-12a7 7 0 1 0-14 0c0 4.42 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.5" />
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

function navClass(isActive: boolean) {
  return `flex items-center gap-2.5 rounded-lg px-4 py-2.5 font-sans text-[13px] ${
    isActive ? "bg-tn-blue-bg font-semibold text-tn-blue" : "font-medium text-tn-nav-inactive"
  }`;
}

/**
 * Matches the mockup's T12 Settings frame's left nav — shared by every
 * T12* sub-page. The mockup draws this as a second, full-height sidebar
 * flush against AppShell's main nav (same background, no card/border),
 * not a card floating inside the page's normal content padding. AppShell
 * applies that padding uniformly to every route's content
 * (px-10 py-8 on the Outlet wrapper), so the only way for this one route
 * to visually escape it is to cancel it back out here with matching
 * negative margins, then let the two inner columns re-apply their own
 * padding independently — the nav's for its own inset content, the
 * content column's to keep every T12* sub-page visually unchanged.
 *
 * The mockup gives this nav its own shade (oklch(96% .012 75), same
 * tone as a table header) rather than reusing AppShell's sidebar
 * background — with a border to match, the two otherwise blend into one
 * long sidebar with no visible seam between "app nav" and "settings nav".
 */
/**
 * What a settings page can ask the chrome around it to do.
 *
 * Only one thing so far: the Locations page collapses this nav to an icon
 * rail when a location is selected, because its detail pane wants the
 * width and the nav is not what you are looking at while you are inside
 * one shop. Read with useSettingsChrome() below.
 */
export interface SettingsChrome {
  setNavCollapsed: (collapsed: boolean) => void;
}

/** Typed accessor for the Outlet context above — pages call this rather than useOutletContext directly. */
export function useSettingsChrome(): SettingsChrome {
  return useOutletContext<SettingsChrome>();
}

export function SettingsLayout() {
  const { has } = usePermissions();
  const [navCollapsed, setNavCollapsed] = useState(false);
  const visible = (items: SettingsNavItem[]) =>
    items.filter((item) => !item.permission || has(item.permission));

  const generalItems = visible(GENERAL_ITEMS);
  const workspaceItems = visible(WORKSPACE_ITEMS);

  return (
    <div className="-my-8 flex min-h-screen">
      <nav
        className={`-ml-10 flex flex-none flex-col gap-6 border-r border-tn-border bg-tn-table-head py-8 transition-[width] duration-200 ease-in-out ${
          navCollapsed ? "w-[76px] overflow-hidden" : "w-[240px]"
        }`}
      >
        <p
          className={`m-0 font-serif font-semibold text-tn-ink ${
            navCollapsed ? "px-0 text-center text-lg" : "px-4 text-[22px]"
          }`}
        >
          {navCollapsed ? "iG" : "Settings"}
        </p>
        <div>
          {!navCollapsed && (
            <p className="m-0 mb-2 px-4 font-sans text-[11px] font-semibold tracking-[0.04em] text-tn-faint">
              GENERAL
            </p>
          )}
          <div className="flex flex-col gap-0.5">
            {generalItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                title={navCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `${navClass(isActive)} ${navCollapsed ? "justify-center" : ""}`
                }
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                {!navCollapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </div>
        </div>

        {workspaceItems.length > 0 && (
          <div>
            {!navCollapsed && (
              <p className="m-0 mb-2 px-4 font-sans text-[11px] font-semibold tracking-[0.04em] text-tn-faint">
                WORKSPACE SETTINGS
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {workspaceItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={navCollapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `${navClass(isActive)} ${navCollapsed ? "justify-center" : ""}`
                  }
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  {!navCollapsed && <span className="flex-1">{item.label}</span>}
                  {!navCollapsed && item.badge && (
                    <span className="rounded-full bg-tn-gold-bg px-1.5 py-0.5 font-sans text-[9px] font-semibold text-tn-gold">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="min-w-0 flex-1 py-8 pl-10">
        <Outlet context={{ setNavCollapsed } satisfies SettingsChrome} />
      </div>
    </div>
  );
}

export default SettingsLayout;
