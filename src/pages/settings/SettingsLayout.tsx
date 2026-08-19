import type { ReactNode } from "react";
import { NavLink, Outlet } from "react-router";

type NavIconComponent = (props: { className?: string }) => ReactNode;

const GENERAL_ITEMS: Array<{ to: string; label: string; icon: NavIconComponent; end?: boolean }> = [
  { to: "/settings", label: "Business Profile", icon: BusinessProfileIcon, end: true },
  { to: "/settings/hours", label: "Availability", icon: AvailabilityIcon },
  { to: "/settings/security", label: "Security", icon: SecurityIcon },
];

const WORKSPACE_ITEMS: Array<{
  to: string;
  label: string;
  icon: NavIconComponent;
  badge?: string;
}> = [
  { to: "/settings/locations", label: "Locations", icon: LocationsIcon },
  { to: "/settings/staff", label: "Staff Management", icon: StaffIcon },
  {
    to: "/settings/integrations",
    label: "Integrations",
    icon: IntegrationsIcon,
    badge: "BUSINESS",
  },
  { to: "/settings/billing", label: "Billing & Plan", icon: BillingIcon },
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
export function SettingsLayout() {
  return (
    <div className="-my-8 flex min-h-screen">
      <nav className="-ml-10 flex w-[240px] flex-none flex-col gap-6 border-r border-tn-border bg-tn-table-head py-8">
        <p className="m-0 px-4 font-serif text-[22px] font-semibold text-tn-ink">Settings</p>
        <div>
          <p className="m-0 mb-2 px-4 font-sans text-[11px] font-semibold tracking-[0.04em] text-tn-faint">
            GENERAL
          </p>
          <div className="flex flex-col gap-0.5">
            {GENERAL_ITEMS.map((item) => (
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

        <div>
          <p className="m-0 mb-2 px-4 font-sans text-[11px] font-semibold tracking-[0.04em] text-tn-faint">
            WORKSPACE SETTINGS
          </p>
          <div className="flex flex-col gap-0.5">
            {WORKSPACE_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => navClass(isActive)}>
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="rounded-full bg-tn-gold-bg px-1.5 py-0.5 font-sans text-[9px] font-semibold text-tn-gold">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      <div className="min-w-0 flex-1 py-8 pl-10">
        <Outlet />
      </div>
    </div>
  );
}

export default SettingsLayout;
