import { NavLink, Outlet, useNavigate } from "react-router";
import { useAuthStore } from "@/auth/auth-store";

const GENERAL_ITEMS = [
  { to: "/settings", label: "Profile", icon: "👤", end: true },
  { to: "/settings/hours", label: "Hours & Availability", icon: "🕐" },
  { to: "/settings/security", label: "Security", icon: "🔒" },
];

const WORKSPACE_ITEMS = [
  { to: "/settings/locations", label: "Locations", icon: "📍" },
  { to: "/settings/staff", label: "Staff Management", icon: "👥" },
  { to: "/settings/integrations", label: "Integrations", icon: "🔌", badge: "BUSINESS" },
  { to: "/settings/billing", label: "Billing & Plan", icon: "💳" },
];

function navClass(isActive: boolean) {
  return `flex items-center gap-2.5 rounded-lg px-4 py-2.5 font-sans text-[13px] ${
    isActive ? "bg-tn-blue-bg font-semibold text-tn-blue" : "font-medium text-tn-nav-inactive"
  }`;
}

/** Matches the mockup's T12 Settings frame's left nav — shared by every T12* sub-page. */
export function SettingsLayout() {
  const navigate = useNavigate();
  const logOut = useAuthStore((s) => s.logOut);

  function handleLogOut() {
    logOut();
    navigate("/");
  }

  return (
    <div className="flex gap-10">
      <nav className="flex w-[200px] flex-none flex-col gap-6 rounded-2xl bg-tn-table-head p-5">
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
                <span aria-hidden>{item.icon}</span>
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
                <span aria-hidden>{item.icon}</span>
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

        <button
          type="button"
          onClick={handleLogOut}
          className="mt-auto flex cursor-pointer items-center justify-between border-none bg-transparent px-4 py-2 text-left font-sans text-[13px] font-medium text-tn-muted-5"
        >
          Log out <span aria-hidden>›</span>
        </button>
      </nav>

      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}

export default SettingsLayout;
