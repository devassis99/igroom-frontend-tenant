import { createBrowserRouter, redirect } from "react-router";
import { setAppNavigate } from "@/lib/navigation";
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
  // Returning-owner sign-in — separate from the signup funnel below.
  {
    path: "/login",
    lazy: () => import("@/pages/LoginPage").then((m) => ({ Component: m.default })),
  },
  // Where a back-office support link lands (see igroom-backend's
  // modules/support-sessions). Outside ProtectedRoute because the visitor
  // has no session yet — the ticket in the URL fragment is what creates
  // one. With no ticket, this doubles as the "session ended" screen.
  {
    path: "/support-session",
    lazy: () => import("@/pages/SupportSessionPage").then((m) => ({ Component: m.default })),
  },
  // Brief branded loading transition shown after a successful login or at
  // the end of the signup/onboarding funnel, before landing on the real
  // destination — see RedirectPage.tsx.
  {
    path: "/redirecting",
    lazy: () => import("@/pages/RedirectPage").then((m) => ({ Component: m.default })),
  },
  // Signup funnel, in wizard order: Account -> Business details ->
  // Availability -> Plan -> Checkout -> Receipt -> Dashboard. Business
  // details and availability now come before payment (see
  // BusinessDetailsPage's and StaffAvailabilityPage's comments) so the
  // account can be created — by ReceiptPage, right after Stripe's real
  // hosted Checkout completes (an external redirect, not an in-app
  // route) — with the real business name and schedule already known.
  {
    path: "/signup",
    lazy: () => import("@/pages/CreateAccountPage").then((m) => ({ Component: m.default })),
  },
  {
    path: "/signup/business",
    lazy: () => import("@/pages/BusinessDetailsPage").then((m) => ({ Component: m.default })),
  },
  {
    path: "/signup/availability",
    lazy: () => import("@/pages/StaffAvailabilityPage").then((m) => ({ Component: m.default })),
  },
  {
    path: "/signup/plan",
    lazy: () => import("@/pages/ChoosePlanPage").then((m) => ({ Component: m.default })),
  },
  // Stripe redirects here (success_url — see accounts.service.ts's
  // createCheckoutSession) once the visitor finishes paying. This is
  // what actually calls POST /accounts/signup — see ReceiptPage.tsx.
  {
    path: "/signup/receipt",
    lazy: () => import("@/pages/ReceiptPage").then((m) => ({ Component: m.default })),
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        lazy: () => import("@/components/layout/AppShell").then((m) => ({ Component: m.default })),
        children: [
          {
            // URL kept as "/dashboard" (rather than renamed to "/home")
            // so RedirectPage's default post-login/post-signup
            // destination and LandingPage's authenticated redirect don't
            // need to change alongside this split — see HomePage.tsx's
            // comment for what moved off this page.
            path: "dashboard",
            lazy: () => import("@/pages/HomePage").then((m) => ({ Component: m.default })),
          },
          {
            path: "analytics",
            lazy: () => import("@/pages/AnalyticsPage").then((m) => ({ Component: m.default })),
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
              // Roles & Permissions used to be its own page here — it's now
              // the Roles tab on Staff Management itself (see
              // StaffManagementPage.tsx's activeTab state), so this route
              // just forwards any old link/bookmark there.
              {
                path: "staff/roles",
                loader: () => redirect("/settings/staff"),
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

// http.ts redirects on a dead session but lives outside the component
// tree. Handing it the navigate function here — rather than letting it
// import this module — is what keeps src/lib free of any dependency on the
// route tree. See lib/navigation.ts for why that matters.
setAppNavigate((path) => {
  void router.navigate(path);
});
