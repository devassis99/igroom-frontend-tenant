import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import { useAuthStore } from "@/auth/auth-store";
import { IntegrationsModal } from "@/components/integrations/IntegrationsModal";
import { WhatsNewDrawer } from "./WhatsNewDrawer";

const NAV_ITEMS: Array<{ to: string; label: string; shape: "square" | "circle" }> = [
  // Label is "Home" even though the URL stays "/dashboard" — see
  // HomePage.tsx's comment on why the mockup's single T6 Owner Dashboard
  // frame is now split into this (onboarding/welcome) and Analytics
  // (reporting) below.
  { to: "/dashboard", label: "Home", shape: "square" },
  { to: "/analytics", label: "Analytics", shape: "square" },
  { to: "/calendar", label: "Calendar", shape: "circle" },
  { to: "/waitlist", label: "Waitlist", shape: "square" },
  { to: "/services", label: "Services", shape: "square" },
  { to: "/staff", label: "Staff", shape: "circle" },
  { to: "/customers", label: "Customers", shape: "square" },
  { to: "/payments", label: "Payments", shape: "square" },
];

function NavIcon({ shape, active }: { shape: "square" | "circle"; active: boolean }) {
  return (
    <span
      className={`block h-4 w-4 shrink-0 ${shape === "circle" ? "rounded-full" : "rounded"} ${
        active ? "bg-current" : "border-2 border-current"
      }`}
      aria-hidden
    />
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
export function AppShell() {
  const navigate = useNavigate();
  const owner = useAuthStore((s) => s.owner);
  const logOut = useAuthStore((s) => s.logOut);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);

  // ProtectedRoute (see routes/ProtectedRoute.tsx) redirects to "/" for
  // any anonymous visit, but a deliberate logout should land on the
  // login form specifically, not the marketing landing page — the owner
  // just proved they have an account.
  function handleLogOut() {
    logOut();
    navigate("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-tn-page">
      <aside className="relative flex w-[220px] shrink-0 flex-col overflow-y-auto py-6">
        <p className="m-0 mb-3.5 px-6 font-serif text-lg font-semibold text-tn-ink">iGroom</p>

        <nav className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                `flex items-center gap-3 px-6 py-[11px] font-sans text-[13px] ${
                  isActive
                    ? "bg-tn-dark font-semibold text-tn-on-dark"
                    : "font-medium text-tn-nav-inactive"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <NavIcon shape={item.shape} active={isActive} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => setWhatsNewOpen((v) => !v)}
          className="flex cursor-pointer items-center gap-2.5 border-none bg-transparent px-6 pb-4 text-left"
        >
          <span className="font-sans text-base text-tn-gold" aria-hidden>
            ✨
          </span>
          <span className="font-sans text-[13px] font-medium text-tn-nav-inactive">
            What&rsquo;s New
          </span>
        </button>

        <div className="mb-1 flex flex-col gap-0.5">
          <button
            type="button"
            onClick={() => setIntegrationsOpen(true)}
            className={`flex items-center justify-between px-6 py-[11px] font-sans text-[13px] ${
              integrationsOpen
                ? "bg-tn-dark font-semibold text-tn-on-dark"
                : "font-medium text-tn-nav-inactive"
            }`}
          >
            <span className="flex items-center gap-3">
              <NavIcon shape="square" active={integrationsOpen} />
              <span>Integrations</span>
            </span>
            <span className="rounded-full bg-tn-gold-bg px-[7px] py-0.5 font-sans text-[9px] font-semibold tracking-[0.02em] text-tn-gold">
              BUSINESS
            </span>
          </button>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-6 py-[11px] font-sans text-[13px] ${
                isActive
                  ? "bg-tn-dark font-semibold text-tn-on-dark"
                  : "font-medium text-tn-nav-inactive"
              }`
            }
          >
            <span className="font-sans text-[15px] leading-4" aria-hidden>
              ⚙
            </span>
            <span>Settings</span>
          </NavLink>
        </div>

        <div className="flex items-center gap-2 px-6">
          <NavLink to="/settings" className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[oklch(90%_0.03_20)] font-sans text-xs font-semibold text-tn-ink">
              {owner?.fullName?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0">
              <p className="m-0 truncate font-sans text-xs font-semibold text-tn-ink-soft">
                {owner?.fullName ?? "Shop owner"}
              </p>
              <p className="m-0 truncate font-sans text-[11px] text-tn-muted-5">
                {owner?.businessName ?? "Your shop"}
              </p>
            </div>
          </NavLink>
          <button
            type="button"
            onClick={handleLogOut}
            title="Log out"
            aria-label="Log out"
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-tn-muted-5 hover:bg-tn-page hover:text-tn-ink"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M16 17l5-5-5-5M21 12H9"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <WhatsNewDrawer open={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} />
      </aside>

      <div className="flex-1 overflow-y-auto bg-tn-surface px-10 py-8">
        <Outlet />
      </div>

      <IntegrationsModal open={integrationsOpen} onClose={() => setIntegrationsOpen(false)} />
    </div>
  );
}

export default AppShell;
