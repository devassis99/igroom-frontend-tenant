import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuthStore } from "@/auth/auth-store";
import { endSupportSession } from "@/lib/support-session-api";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * The read-only bar an operator sees while signed in through a support
 * session.
 *
 * This is *not* a "you are being watched" banner for the shop — the shop
 * never sees it. It renders off the support token, which only ever exists
 * in the browser tab the operator opened from the back office; a shop
 * owner logging in normally has no such token and this returns null for
 * them, exactly as it does for every other page load in the app.
 *
 * It's here for the operator, and it earns its place: without it, the
 * first write they attempt fails with a 403 that reads like a bug in the
 * shop's account rather than the rule it actually is, and there'd be no
 * way to tell a support tab apart from a real login at a glance — which
 * is how someone ends up debugging the wrong shop.
 *
 * Fixed to the bottom of the viewport rather than inserted into the
 * layout, so it can't shift anything the operator is trying to reproduce.
 */
export function SupportSessionBar() {
  const support = useAuthStore((s) => s.support);
  const accessToken = useAuthStore((s) => s.accessToken);
  const owner = useAuthStore((s) => s.owner);
  const logOut = useAuthStore((s) => s.logOut);
  const navigate = useNavigate();
  const [remaining, setRemaining] = useState(0);
  const [ending, setEnding] = useState(false);

  const expiresAt = support?.expiresAt;

  useEffect(() => {
    if (!expiresAt) return;
    const target = new Date(expiresAt).getTime();
    const tick = () => setRemaining(target - Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  if (!support) return null;

  async function handleEnd() {
    setEnding(true);
    try {
      // Best-effort: the local session is cleared either way, but the
      // server call is what actually revokes the token — without it the
      // JWT would keep working from anywhere else it had been copied.
      if (accessToken) await endSupportSession(accessToken);
    } catch {
      // An already-expired or already-ended session throws here. Nothing
      // to recover — the outcome the operator asked for is the same.
    } finally {
      logOut();
      navigate("/support-session", { replace: true });
    }
  }

  const expired = remaining <= 0;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center p-3">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-tn-border bg-tn-dark px-4 py-2 shadow-lg">
        <span className="flex h-2 w-2 shrink-0 rounded-full bg-tn-gold-soft" aria-hidden />
        <span className="font-sans text-xs font-semibold text-tn-on-dark">
          Read-only support session
        </span>
        <span className="font-sans text-[11px] text-tn-on-dark/70">
          {support.shopName}
          {owner?.fullName ? ` · as ${owner.fullName}` : ""}
        </span>
        <span
          className="font-mono text-[11px] tabular-nums text-tn-on-dark/70"
          title="Time left before this session expires"
        >
          {expired ? "expired" : formatRemaining(remaining)}
        </span>
        <button
          type="button"
          onClick={handleEnd}
          disabled={ending}
          className="rounded-full bg-tn-on-dark/15 px-3 py-1 font-sans text-[11px] font-semibold text-tn-on-dark disabled:opacity-50"
        >
          {ending ? "Ending…" : "End session"}
        </button>
      </div>
    </div>
  );
}

export default SupportSessionBar;
