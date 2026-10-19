import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet } from "react-router";
import { useAuthStore } from "@/auth/auth-store";
import { getMe } from "@/lib/accounts-api";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { SupportSessionBar } from "@/components/layout/SupportSessionBar";

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
  const accessToken = useAuthStore((s) => s.accessToken);
  const support = useAuthStore((s) => s.support);
  // The same query (and cache) use-permissions.ts reads. Not for a
  // support session: an operator looking at a shop isn't the owner who
  // has to name it.
  const me = useQuery({
    queryKey: ["me", "permissions"],
    queryFn: () => getMe(accessToken ?? ""),
    enabled: status === "authenticated" && !!accessToken && !support,
    staleTime: 60_000,
  });

  if (status === "unknown") return <LoadingScreen />;
  if (status === "anonymous") return <Navigate to="/login" replace />;
  // Paid, account created, shop not named yet — signup's business step
  // comes after payment, and an owner who closed the tab there would
  // otherwise land in an app (and hand out a booking link) under the
  // placeholder "Jordan Rivera's shop". Back to that step until it's done,
  // on any device.
  if (me.data?.account?.needsBusinessDetails) return <Navigate to="/signup/business" replace />;

  // SupportSessionBar renders null unless this tab holds a support token,
  // so a normal shop-owner session is completely unaffected. It sits here
  // rather than inside AppShell so it covers every authenticated route
  // without touching that component's layout — it's fixed-position and
  // adds nothing to the flow.
  return (
    <>
      <Outlet />
      <SupportSessionBar />
    </>
  );
}

export default ProtectedRoute;
