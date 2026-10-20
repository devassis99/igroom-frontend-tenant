import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { useAuthStore } from "@/auth/auth-store";
import { Button } from "@/components/ui/Button";
import { OtpInput } from "@/components/ui/OtpInput";
import { Field, formInputClass } from "@/components/ui/FormField";
import {
  changeUnverifiedEmail,
  getEmailVerification,
  sendEmailVerificationCode,
  verifyEmailCode,
  type EmailVerificationStatus,
  type MeResponse,
} from "@/lib/accounts-api";
import { ApiError } from "@/lib/http";

const STATUS_KEY = ["email-verification"] as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function messageOf(err: unknown, fallback: string): string {
  return err instanceof ApiError || err instanceof Error ? err.message : fallback;
}

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function countdown(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Re-renders every second while something on screen is counting down. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

/**
 * The verify-your-email modal, over a disabled app.
 *
 * Shown by ProtectedRoute to an owner who signed up with an email and a
 * password — and only them: a Google signup has already proved the
 * address, and invited staff proved theirs by opening the invite. Signup
 * itself finishes first (payment, business details, hours); this is what
 * stands between that and the dashboard. The API enforces the same thing
 * (403 EMAIL_NOT_VERIFIED on everything but this flow), so the app behind
 * isn't just hidden, it's off.
 *
 * A code is sent automatically the first time. The limits come from the
 * server and are shown rather than discovered: five wrong tries per code,
 * a minute between codes and five an hour, three address changes a day.
 * There's no close button — the ways out are verifying, changing the
 * address, or logging out.
 */
export function VerifyEmailGate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken) ?? "";
  const logOut = useAuthStore((s) => s.logOut);
  const updateOwner = useAuthStore((s) => s.updateOwner);

  const [stage, setStage] = useState<"code" | "change">("code");
  const [code, setCode] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const status = useQuery({
    queryKey: STATUS_KEY,
    queryFn: () => getEmailVerification(accessToken),
    enabled: !!accessToken,
  });
  const current = status.data;
  const refetchStatus = status.refetch;

  function markVerified() {
    queryClient.setQueryData<MeResponse>(["me", "permissions"], (old) =>
      old ? { ...old, staffUser: { ...old.staffUser, emailVerified: true } } : old,
    );
    // Everything else was refused until now — fetch it fresh.
    void queryClient.invalidateQueries();
  }

  const send = useMutation({
    mutationFn: () => sendEmailVerificationCode(accessToken),
    onSuccess: (next: EmailVerificationStatus) => {
      queryClient.setQueryData(STATUS_KEY, next);
      setCode("");
      setError(null);
      setNotice(`Code sent to ${next.email}.`);
    },
    onError: (err) => {
      setNotice(null);
      setError(messageOf(err, "Couldn't send a code — try again."));
      void refetchStatus();
    },
  });

  const verify = useMutation({
    mutationFn: (value: string) => verifyEmailCode(accessToken, value),
    onSuccess: markVerified,
    onError: (err) => {
      setNotice(null);
      setCode("");
      setError(messageOf(err, "Couldn't check that code — try again."));
      // Attempts left, or a code that's now locked, come from the server.
      void refetchStatus();
    },
  });

  const change = useMutation({
    mutationFn: (email: string) => changeUnverifiedEmail(accessToken, email),
    onSuccess: (next: EmailVerificationStatus) => {
      queryClient.setQueryData(STATUS_KEY, next);
      queryClient.setQueryData<MeResponse>(["me", "permissions"], (old) =>
        old ? { ...old, staffUser: { ...old.staffUser, email: next.email } } : old,
      );
      updateOwner({ workEmail: next.email });
      setStage("code");
      setNewEmail("");
      setCode("");
      setError(null);
      setNotice(`Email changed — we sent a code to ${next.email}.`);
    },
    onError: (err) => setError(messageOf(err, "Couldn't change your email — try again.")),
  });

  // The first time through, nothing has been sent yet: send it, once.
  const sendCode = send.mutate;
  const autoSent = useRef(false);
  useEffect(() => {
    if (!current || autoSent.current) return;
    if (
      !current.verified &&
      !current.code &&
      !current.nextSendAt &&
      current.sendsLeftThisHour > 0
    ) {
      autoSent.current = true;
      sendCode();
    }
  }, [current, sendCode]);

  // Verified in another tab, or by signing in with Google meanwhile.
  useEffect(() => {
    if (current?.verified) markVerified();
    // markVerified only touches the query cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.verified]);

  const nextSendMs = current?.nextSendAt ? new Date(current.nextSendAt).getTime() : 0;
  const codeExpiresMs = current?.code ? new Date(current.code.expiresAt).getTime() : 0;
  const now = useNow(nextSendMs > Date.now() || codeExpiresMs > Date.now());
  const waitMs = nextSendMs - now;
  const codeUsable = !!current?.code && codeExpiresMs > now;
  const outOfSends = current?.sendsLeftThisHour === 0;

  function submitCode(value = code) {
    if (value.length !== 6 || verify.isPending) return;
    setError(null);
    verify.mutate(value);
  }

  function submitEmail(e: FormEvent) {
    e.preventDefault();
    const email = newEmail.trim();
    if (!EMAIL_PATTERN.test(email)) {
      setError("That doesn't look like an email address.");
      return;
    }
    setError(null);
    change.mutate(email);
  }

  function handleLogOut() {
    logOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <AppBackdrop />
      <div aria-hidden className="absolute inset-0 bg-tn-backdrop" />

      <div
        // Same as Modal.tsx: a native <dialog> needs showModal() and its own
        // focus handling, and this one never closes anyway.
        // eslint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="dialog"
        aria-modal="true"
        aria-labelledby="verify-email-title"
        className="relative flex w-full max-w-[420px] flex-col gap-5 rounded-2xl border border-tn-border bg-tn-surface p-7 shadow-2xl"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-tn-gold-bg text-tn-gold">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect
                x="3"
                y="5"
                width="18"
                height="14"
                rx="2.5"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path
                d="m4 7 8 6 8-6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div className="flex flex-col gap-1.5">
            <h2
              id="verify-email-title"
              className="m-0 font-sans text-[20px] font-semibold text-tn-ink"
            >
              {stage === "code" ? "Verify your email" : "Change your email"}
            </h2>
            {stage === "code" ? (
              <p className="m-0 font-sans text-[14px] leading-relaxed text-tn-muted-5">
                {current ? (
                  <>
                    Enter the 6-digit code we sent to{" "}
                    <span className="font-semibold text-tn-ink">{current.email}</span>. iGroom opens
                    up as soon as it&rsquo;s verified.
                  </>
                ) : (
                  "Checking your account…"
                )}
              </p>
            ) : (
              <p className="m-0 font-sans text-[14px] leading-relaxed text-tn-muted-5">
                We&rsquo;ll send a new code to the new address, and you&rsquo;ll sign in with it
                from now on.
              </p>
            )}
          </div>
        </div>

        {stage === "code" ? (
          <div className="flex flex-col gap-4">
            <OtpInput
              value={code}
              onChange={(value) => {
                setCode(value);
                setError(null);
              }}
              onComplete={submitCode}
              disabled={!codeUsable || verify.isPending}
            />

            {error ? (
              <p role="alert" className="m-0 text-center font-sans text-[13px] text-tn-danger">
                {error}
              </p>
            ) : notice ? (
              <p className="m-0 text-center font-sans text-[13px] text-tn-success">{notice}</p>
            ) : current?.code && codeUsable && current.code.attemptsLeft < 5 ? (
              <p className="m-0 text-center font-sans text-[13px] text-tn-muted-5">
                {current.code.attemptsLeft}{" "}
                {current.code.attemptsLeft === 1 ? "attempt" : "attempts"} left for this code
              </p>
            ) : current && !codeUsable && !send.isPending ? (
              <p className="m-0 text-center font-sans text-[13px] text-tn-muted-5">
                {current.code ? "That code has expired." : "There's no active code."} Send a new one
                below.
              </p>
            ) : null}

            <Button
              size="lg"
              className="w-full"
              onClick={() => submitCode()}
              disabled={!codeUsable || code.length !== 6 || verify.isPending}
            >
              {verify.isPending ? "Checking…" : "Verify email"}
            </Button>

            <div className="flex flex-col items-center gap-1 font-sans text-[13px] text-tn-muted-5">
              {outOfSends && current?.nextSendAt ? (
                <span className="text-center">
                  You&rsquo;ve asked for 5 codes in the last hour. You can ask for another at{" "}
                  {clockTime(current.nextSendAt)}.
                </span>
              ) : (
                <span>
                  Didn&rsquo;t get it? Check spam, or{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      send.mutate();
                    }}
                    disabled={send.isPending || waitMs > 0}
                    className="cursor-pointer border-none bg-transparent p-0 font-sans text-[13px] font-semibold text-tn-ink underline disabled:cursor-not-allowed disabled:text-tn-faint disabled:no-underline"
                  >
                    {send.isPending
                      ? "sending…"
                      : waitMs > 0
                        ? `send a new code in ${countdown(waitMs)}`
                        : "send a new code"}
                  </button>
                </span>
              )}
              {current && current.emailChangesLeft > 0 ? (
                <span>
                  Wrong address?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setStage("change");
                      setError(null);
                      setNotice(null);
                    }}
                    className="cursor-pointer border-none bg-transparent p-0 font-sans text-[13px] font-semibold text-tn-ink underline"
                  >
                    Change your email
                  </button>
                </span>
              ) : current?.nextEmailChangeAt ? (
                <span className="text-center">
                  You&rsquo;ve changed your email 3 times today — you can change it again after{" "}
                  {clockTime(current.nextEmailChangeAt)}.
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <form onSubmit={submitEmail} className="flex flex-col gap-4">
            <Field label="NEW EMAIL">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => {
                  setNewEmail(e.target.value);
                  setError(null);
                }}
                placeholder="you@yourshop.com"
                autoComplete="email"
                className={formInputClass}
              />
            </Field>
            {error ? (
              <p role="alert" className="m-0 font-sans text-[13px] text-tn-danger">
                {error}
              </p>
            ) : current ? (
              <p className="m-0 font-sans text-[13px] text-tn-muted-5">
                Currently {current.email}. You can change it {current.emailChangesLeft} more{" "}
                {current.emailChangesLeft === 1 ? "time" : "times"} today.
              </p>
            ) : null}
            <div className="flex gap-2.5">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setStage("code");
                  setError(null);
                }}
                disabled={change.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={change.isPending || !newEmail.trim()}
              >
                {change.isPending ? "Sending…" : "Send code"}
              </Button>
            </div>
          </form>
        )}

        <div className="flex items-center justify-center border-t border-tn-border-soft pt-4">
          <button
            type="button"
            onClick={handleLogOut}
            className="cursor-pointer border-none bg-transparent p-0 font-sans text-[13px] font-medium text-tn-muted-5 hover:text-tn-ink"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * A still of the app, blurred, behind the modal — what the owner is about
 * to get into. Drawn, not the real app: the real pages would only fetch
 * data the API refuses until the email is verified.
 */
function AppBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 flex bg-tn-page blur-[2px]">
      <div className="flex w-[220px] flex-none flex-col gap-4 px-6 py-7">
        <div className="mb-3 h-5 w-24 rounded bg-tn-border" />
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-4 w-4 rounded bg-tn-border" />
            <div
              className="h-3 rounded bg-tn-border"
              style={{ width: `${55 + ((i * 17) % 40)}px` }}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-5 bg-tn-surface px-10 py-8">
        <div className="h-7 w-56 rounded bg-tn-border-soft" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-28 rounded-2xl border border-tn-border-soft bg-tn-page" />
          ))}
        </div>
        <div className="h-64 rounded-2xl border border-tn-border-soft bg-tn-page" />
      </div>
    </div>
  );
}

export default VerifyEmailGate;
