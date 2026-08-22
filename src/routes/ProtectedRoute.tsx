import { Navigate, Outlet } from "react-router";
import { useAuthStore } from "@/auth/auth-store";
import { LoadingScreen } from "@/components/layout/LoadingScreen";

/**
 * Gates the authenticated app on a mock session created at the end of the
 * signup funnel (see auth-store.ts — there's no real backend session to
 * check, so "unknown" only ever lasts the one tick zustand/persist takes
 * to rehydrate from storage).
 *
 * Redirects anonymous access to "/login", not "/" — this used to point at
 * the marketing landing page on the theory that a *deliberate* logout was
 * handled separately by an explicit `navigate("/login")` call (see
 * AppShell.tsx's handleLogOut and ActiveSessionsModal.tsx's self-revoke).
 * In practice those two navigations race: clicking "Log out" flips
 * auth-store's status to "anonymous" first, which re-renders this
 * still-mounted component (it's on the protected page at that instant)
 * and fires *this* redirect in a layout effect — landing on "/" instead
 * of "/login" more often than not, regardless of the explicit call sites.
 * Pointing this at "/login" directly removes the race instead of trying
 * to win it; a signed-out visitor hitting a protected URL cold now also
 * lands on the login form rather than the marketing page, which is the
 * more standard behavior anyway.
 */
export function ProtectedRoute() {
  const status = useAuthStore((s) => s.status);

  if (status === "unknown") return <LoadingScreen />;
  if (status === "anonymous") return <Navigate to="/login" replace />;

  return <Outlet />;
}

export default ProtectedRoute;
