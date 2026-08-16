import { createBrowserRouter } from "react-router";
import { ProtectedRoute } from "./ProtectedRoute";

/**
 * Route-level code splitting via react-router's `lazy` field, same pattern
 * as igroom-frontend-bo's router.tsx — a visitor who only ever completes
 * signup never downloads the calendar/waitlist/settings bundles, and vice
 * versa for a returning shop owner who lands straight on /dashboard.
 */
export const router = createBrowserRouter([
  {
    path: "/",
    lazy: () => import("@/pages/LandingPage").then((m) => ({ Component: m.default })),
  },
  // Signup funnel, in wizard order: Account -> Plan -> Business details ->
  // Dashboard. Stripe's real hosted Checkout happens between Plan and
  // Business details, but as an external redirect (see ChoosePlanPage's
  // comment), not an in-app route. Business details is last (see
  // BusinessDetailsPage's comment) — it's what actually calls
  // POST /accounts/signup, which creates an active/trialing account
  // outright (no manual-approval step), so Continue there logs the owner
  // straight into /dashboard rather than an in-between "submitted" page.
  {
    path: "/signup",
    lazy: () => import("@/pages/CreateAccountPage").then((m) => ({ Component: m.default })),
  },
  {
    path: "/signup/plan",
    lazy: () => import("@/pages/ChoosePlanPage").then((m) => ({ Component: m.default })),
  },
  {
    path: "/signup/business",
    lazy: () => import("@/pages/BusinessDetailsPage").then((m) => ({ Component: m.default })),
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        lazy: () => import("@/components/layout/AppShell").then((m) => ({ Component: m.default })),
        children: [
          {
            path: "dashboard",
            lazy: () => import("@/pages/DashboardPage").then((m) => ({ Component: m.default })),
          },
          {
            path: "calendar",
            lazy: () => import("@/pages/CalendarPage").then((m) => ({ Component: m.default })),
          },
          {
            path: "waitlist",
            lazy: () => import("@/pages/WaitlistPage").then((m) => ({ Component: m.default })),
          },
          {
            path: "services",
            lazy: () => import("@/pages/ServicesPage").then((m) => ({ Component: m.default })),
          },
          {
            path: "staff",
            lazy: () => import("@/pages/StaffPage").then((m) => ({ Component: m.default })),
          },
          {
            path: "customers",
            lazy: () => import("@/pages/CustomersPage").then((m) => ({ Component: m.default })),
          },
          {
            path: "payments",
            lazy: () => import("@/pages/PaymentsPage").then((m) => ({ Component: m.default })),
          },
          {
            path: "integrations",
            lazy: () => import("@/pages/IntegrationsPage").then((m) => ({ Component: m.default })),
          },
          {
            path: "settings",
            lazy: () =>
              import("@/pages/settings/SettingsLayout").then((m) => ({ Component: m.default })),
            children: [
              {
                index: true,
                lazy: () =>
                  import("@/pages/settings/ProfileSettingsPage").then((m) => ({
                    Component: m.default,
                  })),
              },
              {
                path: "hours",
                lazy: () =>
                  import("@/pages/settings/HoursSettingsPage").then((m) => ({
                    Component: m.default,
                  })),
              },
              {
                path: "security",
                lazy: () =>
                  import("@/pages/settings/SecuritySettingsPage").then((m) => ({
                    Component: m.default,
                  })),
              },
              {
                path: "locations",
                lazy: () =>
                  import("@/pages/settings/LocationsSettingsPage").then((m) => ({
                    Component: m.default,
                  })),
              },
              {
                path: "staff",
                lazy: () =>
                  import("@/pages/settings/StaffManagementPage").then((m) => ({
                    Component: m.default,
                  })),
              },
              {
                path: "integrations",
                lazy: () =>
                  import("@/pages/IntegrationsPage").then((m) => ({ Component: m.default })),
              },
              {
                path: "billing",
                lazy: () =>
                  import("@/pages/settings/BillingSettingsPage").then((m) => ({
                    Component: m.default,
                  })),
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: "*",
    lazy: () => import("@/pages/NotFoundPage").then((m) => ({ Component: m.default })),
  },
]);
