import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAuthStore } from "@/auth/auth-store";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { redeemSupportSession } from "@/lib/support-session-api";

type State = { kind: "redeeming" } | { kind: "no-ticket" } | { kind: "failed"; message: string };

/** The ticket the back office put in the URL fragment, or "" if this page was opened without one. */
function readTicket(): string {
  return window.location.hash.replace(/^#/, "").trim();
}

/**
 * The landing point for a back-office support session — the tenant half
 * of the handoff in igroom-backend's modules/support-sessions.
 *
 * The ticket arrives in the URL *fragment* (`/support-session#<ticket>`),
 * not the query string, for two reasons: fragments are never sent to the
 * server, so the ticket can't end up in this app's access logs, and
 * they're trivially strippable client-side, which is what the
 * history.replaceState below does before anything else can read it. The
 * ticket is single-use and lives about a minute, so even the copy sitting
 * in the operator's browser history is worthless almost immediately.
 *
 * With no ticket in the URL this doubles as the "session over" screen —
 * http.ts sends an expired or revoked support session here rather than to
 * /login, which would be a confusing place to land for someone who never
 * had a password for this shop in the first place.
 */
export function SupportSessionPage() {
  const navigate = useNavigate();
  const startSupportSession = useAuthStore((s) => s.startSupportSession);
  // Read once at mount and kept in state, not re-read per render: the
  // effect strips the fragment from the address bar before the network
  // call, so window.location.hash is empty by the time anything looks
  // again.
  const [ticket] = useState(readTicket);
  // "no-ticket" is decided here rather than in the effect below. It's
  // knowable during the first render — the URL is right there — and
  // setting it from an effect would mean a wasted second render, which is
  // what oxlint's react(set-state-in-effect) is pointing at.
  const [state, setState] = useState<State>(() =>
    ticket ? { kind: "redeeming" } : { kind: "no-ticket" },
  );
  // React 18+ StrictMode double-invokes effects in development. The ticket
  // is single-use, so a second redeem would fail and show an error for a
  // session that actually succeeded — this guard makes the exchange happen
  // exactly once per mount.
  const redeemStarted = useRef(false);

  useEffect(() => {
    if (!ticket || redeemStarted.current) return;
    redeemStarted.current = true;

    // Drop the ticket from the address bar before the network call, not
    // after — if the redeem is slow, that's a long window with a live
    // credential sitting in a URL the operator might screenshot.
    window.history.replaceState(null, "", window.location.pathname);

    async function redeem() {
      try {
        const result = await redeemSupportSession(ticket);
        startSupportSession({
          accessToken: result.accessToken,
          support: {
            sessionId: result.support.sessionId,
            shopName: result.support.shopName,
            expiresAt: result.expiresAt,
          },
          permissions: result.permissions,
          owner: {
            fullName: result.staffUser.name,
            workEmail: result.staffUser.email,
            businessName: result.account.name,
            category: result.account.category ?? "",
            address: result.account.address ?? "",
            phone: result.account.phone ?? "",
            planKey: "",
            planName: "",
            priceCents: 0,
            currency: "usd",
            billingCycle: "monthly",
            seats: 0,
          },
        });
        navigate("/dashboard", { replace: true });
      } catch (err: unknown) {
        setState({
          kind: "failed",
          message:
            err instanceof Error
              ? err.message
              : "This support link is invalid or has already been used.",
        });
      }
    }

    void redeem();
  }, [navigate, startSupportSession, ticket]);

  if (state.kind === "redeeming") return <LoadingScreen />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-tn-page p-6">
      <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-tn-border bg-tn-surface p-8">
        <h1 className="m-0 font-sans text-xl font-semibold text-tn-ink">
          {state.kind === "no-ticket" ? "Support session ended" : "This link didn't work"}
        </h1>
        <p className="m-0 font-sans text-sm leading-relaxed text-tn-muted-5">
          {state.kind === "no-ticket"
            ? "This session has expired or was ended. Support links are single-use — start a new session from the back office to get back in."
            : state.message}
        </p>
        <p className="m-0 font-sans text-xs leading-relaxed text-tn-faint">
          Support links can only be opened once, and expire about a minute after they're created.
        </p>
      </div>
    </div>
  );
}

export default SupportSessionPage;
