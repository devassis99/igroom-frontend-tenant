import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuthStore } from "@/auth/auth-store";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { getMe, redeemInvite } from "@/lib/accounts-api";
import { useStaffOnboardingStore } from "@/auth/staff-onboarding-store";

type State = { kind: "redeeming" } | { kind: "no-token" } | { kind: "failed"; message: string };

/** The token the invite email put in the URL fragment, or "" if this page was opened without one. */
function readToken(): string {
  return window.location.hash.replace(/^#/, "").trim();
}

/**
 * Where an invited staff member lands from their email.
 *
 * The token arrives in the URL *fragment* (`/invite#<token>`) rather than
 * the query string, for the same two reasons as the support-session
 * handoff: fragments are never sent to the server, so the token can't end
 * up in this app's access logs or a Referer header, and they're trivially
 * strippable client-side — which the effect below does before the network
 * call rather than after, so a slow redeem isn't a long window with a live
 * credential sitting in the address bar.
 *
 * Redeeming mints a real session, so this page's only job is to exchange
 * the token and hand off to the setup wizard. Everything the invitee
 * actually fills in happens there.
 */
export function InvitePage() {
  const navigate = useNavigate();
  const loginWithSession = useAuthStore((s) => s.loginWithSession);
  const beginOnboarding = useStaffOnboardingStore((s) => s.begin);

  // Read once at mount and held in state, not re-read per render — the
  // effect strips the fragment before the request goes out.
  const [token] = useState(readToken);
  // Decided during the first render rather than from an effect: the URL is
  // right there, and setting it later would mean a wasted second render
  // (what oxlint's react(set-state-in-effect) points at).
  const [state, setState] = useState<State>(() =>
    token ? { kind: "redeeming" } : { kind: "no-token" },
  );
  // StrictMode double-invokes effects in development. The token is
  // single-use, so a second redeem would fail and show an error for an
  // invite that actually worked — this makes the exchange happen exactly
  // once per mount.
  const redeemStarted = useRef(false);

  useEffect(() => {
    if (!token || redeemStarted.current) return;
    redeemStarted.current = true;

    window.history.replaceState(null, "", window.location.pathname);

    async function redeem() {
      try {
        const session = await redeemInvite(token);
        // Fetch the real identity rather than inventing one: the session
        // exists now, and /accounts/me is what every other page reads.
        const me = await getMe(session.accessToken);
        const account = (me.account ?? {}) as Record<string, string | null>;

        loginWithSession({
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          owner: {
            fullName: me.staffUser.name,
            workEmail: me.staffUser.email,
            businessName: account.name ?? "",
            category: account.category ?? "",
            address: account.address ?? "",
            phone: account.phone ?? "",
            // Billing belongs to the account's owner, not to an invited
            // member — they never see a plan, so there's nothing truthful
            // to put here.
            planKey: "",
            planName: "",
            priceCents: 0,
            currency: "usd",
            billingCycle: "monthly",
            seats: 0,
          },
        });

        beginOnboarding({
          name: me.staffUser.name,
          needsSignInMethod: session.needsSignInMethod,
        });
        navigate("/welcome", { replace: true });
      } catch (err: unknown) {
        setState({
          kind: "failed",
          message:
            err instanceof Error
              ? err.message
              : "This invite link is invalid, already used, or has expired.",
        });
      }
    }

    void redeem();
  }, [navigate, loginWithSession, beginOnboarding, token]);

  if (state.kind === "redeeming") return <LoadingScreen />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-tn-page p-6">
      <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-tn-border bg-tn-surface p-8">
        <h1 className="m-0 font-serif text-xl font-semibold text-tn-ink">
          {state.kind === "no-token" ? "Nothing to set up here" : "This link didn't work"}
        </h1>
        <p className="m-0 font-sans text-sm leading-relaxed text-tn-muted-5">
          {state.kind === "no-token"
            ? "Open the link from your invite email to set up your account."
            : state.message}
        </p>
        <p className="m-0 font-sans text-sm leading-relaxed text-tn-muted-5">
          An invite works once and lasts seven days. If yours has expired or you&rsquo;ve already
          used it, ask whoever invited you to send a new one — or{" "}
          <Link to="/login" className="font-semibold text-tn-ink">
            sign in
          </Link>{" "}
          if you&rsquo;ve already set up your account.
        </p>
      </div>
    </div>
  );
}

export default InvitePage;
