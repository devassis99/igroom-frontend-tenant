import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuthStore } from "@/auth/auth-store";
import { Button } from "@/components/ui/Button";
import { Field, formInputClass } from "@/components/ui/FormField";
import { OtpInput } from "@/components/ui/OtpInput";
import { renderGoogleButton } from "@/lib/google-identity";
import { getMe, login, loginWithGoogle, confirmMfaLoginChallenge } from "@/lib/accounts-api";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/http";

/**
 * The public "/login" entry point for a *returning* owner — separate from
 * CreateAccountPage's "/signup" wizard, which is only step 1 of a new
 * account's funnel. LandingPage's "Log in" link points here now instead
 * of reusing the signup form.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const loginWithSession = useAuthStore((s) => s.loginWithSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleProcessing, setGoogleProcessing] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  // Set once a password/Google identity check succeeds on an account with
  // 2FA enabled — swaps the form below for a single "enter your
  // authenticator code" step instead of finishing the login immediately.
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaSubmitting, setMfaSubmitting] = useState(false);

  /**
   * Shared by both the password and Google paths once a real session
   * exists. Hands off to /redirecting (the branded loading transition)
   * instead of navigating to /dashboard directly, so a successful login
   * always shows the loader for a beat before landing on the dashboard.
   */
  async function completeLogin(accessToken: string, refreshToken: string) {
    const me = await getMe(accessToken);
    loginWithSession({
      owner: {
        fullName: me.staffUser.name,
        workEmail: me.staffUser.email,
        businessName: (me.account?.name as string | undefined) ?? "Your shop",
        category: (me.account?.category as string | undefined) ?? "",
        address: (me.account?.address as string | undefined) ?? "",
        phone: (me.account?.phone as string | undefined) ?? "",
        planKey: "",
        planName: "",
        priceCents: 0,
        currency: "usd",
        billingCycle: "monthly",
        seats: 0,
      },
      accessToken,
      refreshToken,
    });
    navigate("/redirecting", { state: { to: "/dashboard" } });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password to log in.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const outcome = await login({ email: email.trim(), password });
      if (outcome.status === "mfa_challenge_required") {
        setChallengeToken(outcome.challengeToken);
        return;
      }
      await completeLogin(outcome.accessToken, outcome.refreshToken);
    } catch (err) {
      // With http.ts now reading the backend's `{ error }` body correctly,
      // this surfaces the real reason — e.g. "Invalid email or password" —
      // instead of a generic "Request failed" message.
      const message =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Something went wrong logging in. Try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * The 2FA step, shown instead of the main form once challengeToken is
   * set — same completeLogin hand-off as the two identity checks above.
   * Takes the code directly (rather than a FormEvent) so OtpInput's
   * onComplete can auto-submit the moment the 6th digit lands, matching
   * the backoffice app's MfaChallengePage.
   */
  async function submitMfaCode(code: string) {
    if (!challengeToken || code.length !== 6 || mfaSubmitting) return;
    setError(null);
    setMfaSubmitting(true);
    try {
      const tokens = await confirmMfaLoginChallenge(challengeToken, code);
      await completeLogin(tokens.accessToken, tokens.refreshToken);
    } catch (err) {
      const message =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Something went wrong verifying your code. Try again.";
      setError(message);
      setMfaCode("");
    } finally {
      setMfaSubmitting(false);
    }
  }

  // Renders Google's own button (see google-identity.ts's comment on why
  // — a custom button driving One Tap's prompt() was unreliable,
  // silently suppressed by Google's own heuristics). Runs once on mount;
  // onCredential below can fire more than once if the visitor retries
  // after a failed follow-up call.
  useEffect(() => {
    if (!googleButtonRef.current) return;
    const container = googleButtonRef.current;

    async function onCredential(idToken: string) {
      setError(null);
      setGoogleProcessing(true);
      try {
        const outcome = await loginWithGoogle(idToken);

        if (outcome.status === "ok") {
          await completeLogin(outcome.accessToken, outcome.refreshToken);
          return;
        }

        if (outcome.status === "mfa_challenge_required") {
          setChallengeToken(outcome.challengeToken);
          return;
        }

        // No staff account matches this Google identity — this is the
        // login page, not the signup wizard, so send the visitor to sign
        // up rather than silently starting the funnel here.
        setError("No iGroom account found for this Google sign-in yet.");
      } catch (err) {
        const message =
          err instanceof ApiError || err instanceof Error
            ? err.message
            : "Google sign-in failed. Try again.";
        setError(message);
      } finally {
        setGoogleProcessing(false);
      }
    }

    renderGoogleButton(container, env.VITE_GOOGLE_CLIENT_ID, onCredential, {
      text: "signin_with",
      width: 420,
    }).catch((err) => {
      const message =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Couldn't load Google sign-in right now.";
      setError(message);
    });
    // Intentionally runs once — navigate/loginWithSession are stable
    // references across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (challengeToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-tn-page px-4">
        <div className="flex w-[380px] flex-col gap-6">
          <div className="flex flex-col items-center gap-1.5 text-center">
            <p className="m-0 font-serif text-2xl font-semibold text-tn-ink">
              Enter verification code
            </p>
            <p className="m-0 font-sans text-[13px] text-tn-muted-3">
              Open your authenticator app and enter the current code.
            </p>
          </div>

          <div className="flex flex-col gap-[18px] rounded-2xl border border-tn-border bg-tn-surface p-[26px]">
            <OtpInput
              value={mfaCode}
              onChange={setMfaCode}
              onComplete={submitMfaCode}
              disabled={mfaSubmitting}
            />
            <Button
              size="lg"
              onClick={() => submitMfaCode(mfaCode)}
              disabled={mfaSubmitting || mfaCode.length !== 6}
            >
              {mfaSubmitting ? "Verifying…" : "Verify & sign in"}
            </Button>
          </div>

          {error && (
            <p role="alert" className="m-0 text-center font-sans text-sm text-tn-danger">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={() => {
              setChallengeToken(null);
              setMfaCode("");
              setError(null);
            }}
            className="cursor-pointer self-center border-none bg-transparent p-0 font-sans text-[13px] font-medium text-tn-muted-5"
          >
            Back to log in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-tn-surface px-6 py-12">
      <form onSubmit={handleSubmit} className="flex w-[420px] flex-col gap-6">
        <div>
          <h1 className="m-0 mb-1.5 font-serif text-[28px] font-semibold text-tn-ink">
            Log in to iGroom
          </h1>
          <p className="m-0 font-sans text-[13px] text-tn-muted-5">
            Welcome back — sign in to manage your shop.
          </p>
        </div>

        {/* Google renders its own button here (see google-identity.ts) —
            a real user click on it doesn't have the silent-suppression
            risk a custom button driving One Tap's prompt() used to. */}
        <div ref={googleButtonRef} className="flex justify-center" />
        {googleProcessing && (
          <p className="m-0 -mt-3 text-center font-sans text-xs text-tn-muted-5">
            Finishing Google sign-in…
          </p>
        )}

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-tn-border" />
          <span className="font-sans text-xs text-tn-muted-6">or</span>
          <div className="h-px flex-1 bg-tn-border" />
        </div>

        <div className="flex flex-col gap-3.5">
          <Field label="WORK EMAIL">
            <input
              type="email"
              placeholder="you@yourshop.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={formInputClass}
            />
          </Field>
          <Field label="PASSWORD">
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={formInputClass}
            />
          </Field>
        </div>

        {error && <p className="m-0 font-sans text-xs text-tn-danger">{error}</p>}

        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </Button>

        <p className="m-0 text-center font-sans text-[13px] text-tn-muted-5">
          Don't have a shop on iGroom yet?{" "}
          <Link to="/signup" className="font-medium text-tn-gold">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}

export default LoginPage;
