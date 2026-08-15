import { useState } from "react";
import { NavLink, Outlet } from "react-router";
import { useAuthStore } from "@/auth/auth-store";
import { WhatsNewDrawer } from "./WhatsNewDrawer";

const NAV_ITEMS: Array<{ to: string; label: string; shape: "square" | "circle" }> = [
  { to: "/dashboard", label: "Dashboard", shape: "square" },
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
 * exactly (T6–T12): iGroom wordmark, the 7 primary nav rows, Integrations
 * (BUSINESS-plan badge), the gear-icon Settings row, then What's New and
 * the owner/shop identity block pinned to the bottom.
 *
 * One deviation from the mockup, called out here rather than left silent:
 * T13b draws "Integrations" opening as a modal *over* the Dashboard, but
 * T12f draws a near-identical full Integrations page inside Settings. Two
 * implementations of the same screen would drift, so Integrations is a
 * real route here (IntegrationsPage, reused from both the sidebar link and
 * Settings) instead of a Dashboard-only modal.
 */
export function AppShell() {
  const owner = useAuthStore((s) => s.owner);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-tn-page">
      <aside className="relative flex w-[220px] shrink-0 flex-col py-6">
        <p className="m-0 mb-3.5 px-6 font-serif text-lg font-semibold text-tn-ink">iGroom</p>

        <nav className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                `flex items-center gap-3 px-6 py-[11px] font-sans text-[13px] ${
                  isActive ? "bg-tn-dark font-semibold text-tn-on-dark" : "font-medium text-tn-nav-inactive"
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

          <NavLink
            to="/integrations"
            className={({ isActive }) =>
              `flex items-center justify-between px-6 py-[11px] font-sans text-[13px] ${
                isActive ? "bg-tn-dark font-semibold text-tn-on-dark" : "font-medium text-tn-nav-inactive"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className="flex items-center gap-3">
                  <NavIcon shape="square" active={isActive} />
                  <span>Integrations</span>
                </span>
                <span className="rounded-full bg-tn-gold-bg px-[7px] py-0.5 font-sans text-[9px] font-semibold tracking-[0.02em] text-tn-gold">
                  BUSINESS
                </span>
              </>
            )}
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-6 py-[11px] font-sans text-[13px] ${
                isActive ? "bg-tn-dark font-semibold text-tn-on-dark" : "font-medium text-tn-nav-inactive"
              }`
            }
          >
            <span className="font-sans text-[15px] leading-4" aria-hidden>
              ⚙
            </span>
            <span>Settings</span>
          </NavLink>
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

        <NavLink to="/settings" className="flex items-center gap-2.5 px-6">
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

        <WhatsNewDrawer open={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} />
      </aside>

      <div className="flex-1 overflow-y-auto px-10 py-8">
        <Outlet />
      </div>
    </div>
  );
}

export default AppShell;
