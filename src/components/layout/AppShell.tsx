import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useAuthStore } from "@/auth/auth-store";
import { usePermissions } from "@/auth/use-permissions";
import { requiredPermissionFor } from "@/auth/route-permissions";
import { IntegrationsModal } from "@/components/integrations/IntegrationsModal";
import { AccountMenu } from "./AccountMenu";
import { WhatsNewDrawer } from "./WhatsNewDrawer";

type NavIconComponent = (props: { className?: string }) => ReactNode;

const NAV_ITEMS: Array<{
  to: string;
  label: string;
  icon: NavIconComponent;
  /**
   * staff_permissions.key needed to see this row. Omitted means everyone
   * signed in gets it. Kept in sync with auth/route-permissions.ts, which
   * is what actually gates the route — a row listed here without a
   * matching entry there would be hidden but still reachable by URL.
   */
  permission?: string;
}> = [
  // Label is "Home" even though the URL stays "/dashboard" — see
  // HomePage.tsx's comment on why the mockup's single T6 Owner Dashboard
  // frame is now split into this (onboarding/welcome) and Analytics
  // (reporting) below.
  { to: "/dashboard", label: "Home", icon: HomeIcon },
  { to: "/calendar", label: "Calendar", icon: CalendarIcon, permission: "bookings.view" },
  { to: "/waitlist", label: "Waitlist", icon: WaitlistIcon, permission: "bookings.view" },
  { to: "/analytics", label: "Analytics", icon: AnalyticsIcon, permission: "bookings.view" },
  { to: "/services", label: "Services", icon: ServicesIcon, permission: "services.view" },
  { to: "/staff", label: "Staff", icon: StaffIcon, permission: "staff.view" },
  { to: "/customers", label: "Customers", icon: CustomersIcon, permission: "customers.view" },
  { to: "/payments", label: "Payments", icon: PaymentsIcon, permission: "billing.view" },
];

/**
 * Shared stroke props for the sidebar's glyph set below — same
 * outline-icon family as SidebarToggleIcon/the log-out icon further down,
 * kept in one place so every nav icon reads at the same weight. Every
 * icon inherits its color from the parent NavLink's text color (active =
 * tn-on-dark, inactive = tn-nav-inactive) via `currentColor` instead of
 * taking an `active` prop — no per-icon active/inactive variant needed.
 */
const ICON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

function HomeIcon({ className = "" }: { className?: string }) {
  return (
    <svg {...ICON_PROPS} className={className}>
      <path d="M3.5 10.5 12 3l8.5 7.5" />
      <path d="M5.5 9.5V19a1 1 0 0 0 1 1h3.5v-5.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V20H17.5a1 1 0 0 0 1-1V9.5" />
    </svg>
  );
}

/** Bar-chart glyph for Analytics — three ascending bars drawn as thick round-capped lines. */
function AnalyticsIcon({ className = "" }: { className?: string }) {
  return (
    <svg {...ICON_PROPS} strokeWidth={2.5} className={className}>
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="18" y1="20" x2="18" y2="10" />
    </svg>
  );
}

function CalendarIcon({ className = "" }: { className?: string }) {
  return (
    <svg {...ICON_PROPS} className={className}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

/** Clock glyph for Waitlist — waiting is a function of time, not a list icon, which would read too close to Services/Customers. */
function WaitlistIcon({ className = "" }: { className?: string }) {
  return (
    <svg {...ICON_PROPS} className={className}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14.5" />
    </svg>
  );
}

/** Scissors glyph for Services — the actual thing a chair appointment is. */
function ServicesIcon({ className = "" }: { className?: string }) {
  return (
    <svg {...ICON_PROPS} className={className}>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  );
}

/** Two-person glyph for Staff, vs. CustomersIcon's single person below — keeps the two people-shaped nav rows visually distinct at a glance. */
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

function CustomersIcon({ className = "" }: { className?: string }) {
  return (
    <svg {...ICON_PROPS} className={className}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function PaymentsIcon({ className = "" }: { className?: string }) {
  return (
    <svg {...ICON_PROPS} className={className}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}

/** 2x2 app-grid glyph for Integrations — reads as "connected apps" better than a literal puzzle piece at 18px. */
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

function SettingsGearIcon({ className = "" }: { className?: string }) {
  return (
    <svg {...ICON_PROPS} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/**
 * Sidebar-collapse "panel-left" icon (rounded rect + a divider near the
 * left edge) — same family as a typical collapse/expand toggle, e.g. the
 * one next to iClosed's wordmark that this feature is modeled on.
 */
function SidebarToggleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
      <line x1="9.5" y1="4" x2="9.5" y2="20" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/**
 * A nav row's text (label, badge, ...) — collapses via opacity + max-width
 * rather than being unmounted, so it fades/slides away in step with the
 * `<aside>`'s own width transition instead of just popping out of
 * existence. `shrink-0` on the icons next to this is what keeps them from
 * drifting once this collapses to nothing.
 */
function CollapsibleLabel({
  collapsed,
  className = "",
  children,
}: {
  collapsed: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    // A <div> (not <span>) since one caller's children are block-level <p>
    // tags — every usage here already sits inside a flex row, so the
    // display type doesn't change how it lays out.
    <div
      className={`overflow-hidden whitespace-nowrap transition-[opacity,max-width] duration-200 ease-in-out ${
        collapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Layout for every authenticated route — matches the mockup's sidebar
 * (T6–T12): iGroom wordmark, then the primary nav rows (8, after
 * splitting the mockup's single T6 Owner Dashboard frame into Home +
 * Analytics — see HomePage.tsx's comment), then (pinned to the bottom)
 * What's New, Integrations (BUSINESS-plan badge) and the gear-icon
 * Settings row grouped together as secondary/utility items, and finally
 * the owner/shop identity block with its Log out button.
 *
 * The sidebar's Integrations row matches T13b: it opens IntegrationsModal
 * as an overlay on whatever page you're on, rather than navigating away.
 * Settings > Integrations (T12f) still renders the same content as a full
 * page (IntegrationsPage) — both share CategoryNav/IntegrationCardGrid
 * (see components/integrations/) so the two entry points can't drift.
 */
/** Remembers the owner's collapse preference across reloads, same "just localStorage, no store needed for one boolean" call as sample-data.ts's peers. */
const SIDEBAR_COLLAPSED_KEY = "igroom-sidebar-collapsed";

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const owner = useAuthStore((s) => s.owner);
  const { has, isReady } = usePermissions();

  const visibleNavItems = NAV_ITEMS.filter((item) => !item.permission || has(item.permission));

  // The route half of the same rule the sidebar filter applies, so a
  // hidden menu row isn't still reachable by typing its URL. Waits rather
  // than denies until permissions are known: on a first-ever load with
  // nothing cached, "not fetched yet" and "genuinely not allowed" look
  // identical from here, and guessing wrong locks people out of their own
  // app for a frame.
  const requiredPermission = requiredPermissionFor(location.pathname);
  const routeAllowed = !requiredPermission || !isReady || has(requiredPermission);
  const logOut = useAuthStore((s) => s.logOut);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const whatsNewTriggerRef = useRef<HTMLButtonElement>(null);
  const [storedCollapsed, setStoredCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1",
  );

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, storedCollapsed ? "1" : "0");
  }, [storedCollapsed]);

  // Settings (see SettingsLayout.tsx) renders its own full-height secondary
  // sidebar flush against this one — two side-by-side sidebars reads
  // cramped, so the root nav auto-collapses to its icon rail while any
  // /settings/* route is active. This is a transient, route-driven
  // override: it never touches the owner's persisted storedCollapsed
  // preference, and the toggle button still works to manually re-expand
  // while inside Settings (reset back to collapsed the next time Settings
  // is entered fresh).
  const isSettingsRoute = location.pathname.startsWith("/settings");
  const [expandedInSettings, setExpandedInSettings] = useState(false);

  useEffect(() => {
    if (!isSettingsRoute) setExpandedInSettings(false);
  }, [isSettingsRoute]);

  const collapsed = isSettingsRoute ? !expandedInSettings : storedCollapsed;

  function toggleCollapsed() {
    if (isSettingsRoute) {
      setExpandedInSettings((v) => !v);
    } else {
      setStoredCollapsed((v) => !v);
    }
  }

  // ProtectedRoute (see routes/ProtectedRoute.tsx) now redirects any
  // anonymous access to "/login" itself, so this explicit call is
  // belt-and-suspenders rather than load-bearing — it just gets there
  // one render sooner instead of waiting on ProtectedRoute's own
  // redirect once logOut() flips the store's status.
  function handleLogOut() {
    logOut();
    navigate("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-tn-page">
      <aside
        className={`relative flex ${collapsed ? "w-[76px]" : "w-[220px]"} shrink-0 flex-col overflow-y-auto overflow-x-hidden py-6 transition-[width] duration-300 ease-in-out`}
      >
        <div className="mb-3.5 flex items-center justify-between px-6">
          <CollapsibleLabel
            collapsed={collapsed}
            className="font-serif text-lg font-semibold text-tn-ink"
          >
            iGroom
          </CollapsibleLabel>
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-tn-muted-5 hover:bg-tn-page hover:text-tn-ink"
          >
            <SidebarToggleIcon />
          </button>
        </div>

        <nav className="flex flex-col gap-0.5">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              // Calendar-only: clicking this link while already on /calendar is a
              // same-route navigation — the route doesn't change, so CalendarPage
              // stays mounted and whatever day/scroll position the user had paged
              // to (e.g. next week, scrolled away from "now") just sits there.
              // Stamping a fresh `resetToken` in navigation state on every click
              // still updates `location.state` (a new history entry, new key)
              // even when the pathname is unchanged, which is what lets
              // CalendarPage's own effect (see its `useLocation` usage) notice
              // the click and jump back to today, exactly like its "Today"
              // button already does. Other nav items don't need this — their
              // pages don't carry the same "date you were last looking at"
              // state that a plain route remount wouldn't already reset.
              state={item.to === "/calendar" ? { resetToken: Date.now() } : undefined}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-6 py-[11px] font-sans text-[13px] ${
                  isActive
                    ? "bg-tn-dark font-semibold text-tn-on-dark"
                    : "font-medium text-tn-nav-inactive"
                }`
              }
            >
              {() => (
                <>
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  <CollapsibleLabel collapsed={collapsed}>{item.label}</CollapsibleLabel>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex-1" />

        <button
          ref={whatsNewTriggerRef}
          type="button"
          onClick={() => setWhatsNewOpen((v) => !v)}
          title={collapsed ? "What's New" : undefined}
          className="flex cursor-pointer items-center gap-2.5 border-none bg-transparent px-6 pb-4 text-left"
        >
          <span className="font-sans text-base text-tn-gold" aria-hidden>
            ✨
          </span>
          <CollapsibleLabel
            collapsed={collapsed}
            className="font-sans text-[13px] font-medium text-tn-nav-inactive"
          >
            What&rsquo;s New
          </CollapsibleLabel>
        </button>

        <div className="mb-1 flex flex-col gap-0.5">
          <button
            type="button"
            onClick={() => setIntegrationsOpen(true)}
            title={collapsed ? "Integrations" : undefined}
            className={`flex items-center justify-between px-6 py-[11px] font-sans text-[13px] ${
              integrationsOpen
                ? "bg-tn-dark font-semibold text-tn-on-dark"
                : "font-medium text-tn-nav-inactive"
            }`}
          >
            <span className="flex items-center gap-3">
              <IntegrationsIcon className="h-[18px] w-[18px] shrink-0" />
              <CollapsibleLabel collapsed={collapsed}>Integrations</CollapsibleLabel>
            </span>
            <CollapsibleLabel collapsed={collapsed}>
              <span className="rounded-full bg-tn-gold-bg px-[7px] py-0.5 font-sans text-[9px] font-semibold tracking-[0.02em] text-tn-gold">
                BUSINESS
              </span>
            </CollapsibleLabel>
          </button>

          <NavLink
            to="/settings"
            title={collapsed ? "Settings" : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 px-6 py-[11px] font-sans text-[13px] ${
                isActive
                  ? "bg-tn-dark font-semibold text-tn-on-dark"
                  : "font-medium text-tn-nav-inactive"
              }`
            }
          >
            <SettingsGearIcon className="h-[18px] w-[18px] shrink-0" />
            <CollapsibleLabel collapsed={collapsed}>Settings</CollapsibleLabel>
          </NavLink>
        </div>

        <div className="relative px-6">
          <button
            ref={accountTriggerRef}
            type="button"
            onClick={() => setAccountMenuOpen((v) => !v)}
            title={collapsed ? (owner?.fullName ?? "Shop owner") : undefined}
            aria-haspopup="menu"
            aria-expanded={accountMenuOpen}
            className="flex w-full min-w-0 cursor-pointer items-center gap-2.5 border-none bg-transparent p-0 text-left"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[oklch(90%_0.03_20)] font-sans text-xs font-semibold text-tn-ink">
              {owner?.fullName?.[0]?.toUpperCase() ?? "?"}
            </div>
            <CollapsibleLabel collapsed={collapsed} className="min-w-0">
              <p className="m-0 truncate font-sans text-xs font-semibold text-tn-ink-soft">
                {owner?.fullName ?? "Shop owner"}
              </p>
              <p className="m-0 truncate font-sans text-[11px] text-tn-muted-5">
                {owner?.businessName ?? "Your shop"}
              </p>
            </CollapsibleLabel>
          </button>

          <AccountMenu
            open={accountMenuOpen}
            onClose={() => setAccountMenuOpen(false)}
            owner={owner}
            anchorRef={accountTriggerRef}
            onSettingsClick={() => {
              setAccountMenuOpen(false);
              navigate("/settings");
            }}
            onLogOut={handleLogOut}
          />
        </div>

        <WhatsNewDrawer
          open={whatsNewOpen}
          onClose={() => setWhatsNewOpen(false)}
          anchorRef={whatsNewTriggerRef}
        />
      </aside>

      <div className="flex-1 overflow-y-auto bg-tn-surface px-10 py-8">
        {routeAllowed ? (
          <Outlet />
        ) : (
          <div className="flex flex-col items-start gap-2 rounded-2xl border border-tn-border bg-tn-page p-8">
            <h1 className="m-0 font-sans text-xl font-semibold text-tn-ink">
              You don't have access to this page
            </h1>
            <p className="m-0 font-sans text-sm leading-relaxed text-tn-muted-5">
              Your role doesn't include the{" "}
              <code className="font-mono text-xs text-tn-muted-3">{requiredPermission}</code>{" "}
              permission. Ask whoever owns this account to grant it in Settings &gt; Staff
              Management &gt; Roles.
            </p>
          </div>
        )}
      </div>

      <IntegrationsModal open={integrationsOpen} onClose={() => setIntegrationsOpen(false)} />
    </div>
  );
}

export default AppShell;
