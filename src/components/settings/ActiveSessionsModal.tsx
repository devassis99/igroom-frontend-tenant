import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/auth/auth-store";
import { ApiError } from "@/lib/http";
import { listSessions, revokeSession, revokeOtherSessions, type Session } from "@/lib/accounts-api";

interface ActiveSessionsModalProps {
  open: boolean;
  onClose: () => void;
  accessToken: string;
}

/** A rough, dependency-free "Chrome on Mac" label from a raw User-Agent string — good enough to tell sessions apart, not meant to be exhaustive. */
function describeUserAgent(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  const os = /Mac OS X/.test(ua)
    ? "Mac"
    : /Windows/.test(ua)
      ? "Windows"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad|iPod/.test(ua)
          ? "iOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}

/** session.createdAt is when this session's *current* token was minted, not when it first logged in (see accounts-api.ts's Session type) — worded as "Active", not "Signed in", to stay honest about that. */
function describeRelativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "Active just now";
  if (minutes < 60) return `Active ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Active ${hours}h ago`;
  const days = Math.round(hours / 24);
  return `Active ${days}d ago`;
}

/**
 * Security page's "Active sessions" row. Every currently-valid refresh
 * token IS a session (see security.service.ts's listSessions) — this
 * lists them, flags the caller's own with "THIS DEVICE" (matched
 * server-side against auth-store's own refreshToken), and offers a
 * per-session "Log out" plus a bulk "Log out of all other sessions".
 * Revoking your own current session logs this browser out immediately
 * too, rather than leaving it in a broken half-logged-in state.
 */
export function ActiveSessionsModal({ open, onClose, accessToken }: ActiveSessionsModalProps) {
  const navigate = useNavigate();
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const logOut = useAuthStore((s) => s.logOut);

  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    listSessions(accessToken, refreshToken ?? undefined)
      .then((result) => setSessions(result.sessions))
      .catch((err) => {
        setError(
          err instanceof ApiError ? err.message : "Couldn't load your sessions — try again.",
        );
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reload when the modal opens, not on every accessToken/refreshToken identity change
  }, [open]);

  function handleRevoke(session: Session) {
    setRevokingId(session.id);
    setError(null);
    revokeSession(accessToken, session.id)
      .then(() => {
        if (session.isCurrent) {
          // The token this browser is using is now invalid — clear it
          // locally too instead of leaving a stale, soon-to-fail session.
          logOut();
          navigate("/login");
          return;
        }
        load();
        return;
      })
      .catch((err) => {
        setError(
          err instanceof ApiError ? err.message : "Couldn't log out that session — try again.",
        );
      })
      .finally(() => setRevokingId(null));
  }

  function handleRevokeOthers() {
    if (!refreshToken) return;
    setRevokingOthers(true);
    setError(null);
    revokeOtherSessions(accessToken, refreshToken)
      .then(() => {
        load();
        return;
      })
      .catch((err) => {
        setError(
          err instanceof ApiError ? err.message : "Couldn't log out other sessions — try again.",
        );
      })
      .finally(() => setRevokingOthers(false));
  }

  const otherSessionsCount = (sessions ?? []).filter((s) => !s.isCurrent).length;
  const anyActionInFlight = revokingId !== null || revokingOthers;

  return (
    <Modal open={open} onClose={onClose} width={460}>
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <p className="m-0 font-sans text-lg font-semibold text-tn-ink">Active sessions</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer border-none bg-transparent font-sans text-[13px] font-medium text-tn-muted-1"
          >
            Done
          </button>
        </div>

        {loading && !sessions && (
          <p className="m-0 font-sans text-xs text-tn-muted-5">Loading your sessions…</p>
        )}

        {error && (
          <p className="m-0 rounded-lg bg-tn-danger-bg px-3 py-2 font-sans text-xs text-tn-danger">
            {error}
          </p>
        )}

        {sessions && (
          <div className="flex max-h-[360px] flex-col gap-1.5 overflow-y-auto">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between gap-2.5 rounded-lg border border-tn-border-soft p-2.5"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-sans text-[12.5px] font-semibold text-tn-ink">
                      {describeUserAgent(session.userAgent)}
                    </span>
                    {session.isCurrent && (
                      <span className="shrink-0 rounded-full bg-tn-success-bg px-1.5 py-0.5 font-sans text-[9.5px] font-bold tracking-wide text-tn-success">
                        THIS DEVICE
                      </span>
                    )}
                  </span>
                  <span className="font-sans text-[11px] text-tn-muted-5">
                    {describeRelativeTime(session.createdAt)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRevoke(session)}
                  disabled={anyActionInFlight}
                  className="shrink-0 cursor-pointer border-none bg-transparent p-0 font-sans text-[11.5px] font-medium text-tn-danger-strong disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {revokingId === session.id ? "Logging out…" : "Log out"}
                </button>
              </div>
            ))}
          </div>
        )}

        {sessions && otherSessionsCount > 0 && (
          <Button
            variant="secondary"
            onClick={handleRevokeOthers}
            disabled={anyActionInFlight || !refreshToken}
          >
            {revokingOthers ? "Logging out other sessions…" : "Log out of all other sessions"}
          </Button>
        )}
      </div>
    </Modal>
  );
}

export default ActiveSessionsModal;
