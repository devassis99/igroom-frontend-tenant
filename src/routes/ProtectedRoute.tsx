import { Navigate, Outlet } from "react-router";
import { useAuthStore } from "@/auth/auth-store";
import { LoadingScreen } from "@/components/layout/LoadingScreen";

/**
 * Gates the authenticated app on a mock session created at the end of the
 * signup funnel (see auth-store.ts — there's no real backend session to
 * check, so "unknown" only ever lasts the one tick zustand/persist takes
 * to rehydrate from storage).
 */
export function ProtectedRoute() {
  const status = useAuthStore((s) => s.status);

  if (status === "unknown") return <LoadingScreen />;
  if (status === "anonymous") return <Navigate to="/" replace />;

  return <Outlet />;
}

export default ProtectedRoute;
