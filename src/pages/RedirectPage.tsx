import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { LoadingScreen } from "@/components/layout/LoadingScreen";

const REDIRECT_DELAY_MS = 900;

/**
 * Brief branded loading transition (reuses the mockup's T0 splash frame,
 * LoadingScreen — previously only shown for the one-tick rehydration
 * check in ProtectedRoute) between "we just finished something" and
 * landing on the real destination. Used after a successful login
 * (LoginPage, and CreateAccountPage's "Sign up with Google" returning-
 * owner path) and at the end of the signup/onboarding funnel, once the
 * visitor clicks "Go to Owner Dashboard" on ReceiptPage.
 *
 * Navigate here with `state: { to: "/dashboard" }` — defaults to
 * /dashboard if state is missing (e.g. someone lands here directly).
 */
export function RedirectPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const to = (location.state as { to?: string } | null)?.to ?? "/dashboard";

  useEffect(() => {
    const timer = setTimeout(() => navigate(to, { replace: true }), REDIRECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [navigate, to]);

  return <LoadingScreen />;
}

export default RedirectPage;
