import { type FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useOnboardingStore } from "@/auth/onboarding-store";
import { useAuthStore } from "@/auth/auth-store";
import { Button } from "@/components/ui/Button";
import { Field, formInputClass } from "@/components/ui/FormField";
import { StepProgress } from "@/components/ui/StepProgress";
import { renderGoogleButton } from "@/lib/google-identity";
import { getMe, loginWithGoogle } from "@/lib/accounts-api";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/http";

/**
 * Matches the mockup's T2 "Create your owner account" frame — step 1 of
 * the funnel: Account → Business details → Availability → Plan → Checkout
 * → Receipt. Business details and availability now come before payment
 * so the Receipt page (T5) can show the real business name and a
 * just-completed weekly schedule — see ReceiptPage's comment.
 */
export function CreateAccountPage() {
  const navigate = useNavigate();
  const { fullName, workEmail, password, setAccountDetails, setGoogleIdentity, setLastRoute } =
    useOnboardingStore();
  const loginWithSession = useAuthStore((s) => s.loginWithSession);
  const [error, setError] = useState<string | null>(null);
  const [googleProcessing, setGoogleProcessing] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  // Records "this is the step the visitor is currently on" so a later
  // "Get Started" click from LandingPage resumes here instead of
  // restarting the wizard — see onboarding-store.ts's lastRoute comment.
  useEffect(() => {
    setLastRoute("/signup");
  }, [setLastRoute]);

  // Renders Google's own button (see google-identity.ts's comment on why
  // — the previous custom button + One Tap prompt() combo was
  // unreliable, silently suppressed by Google's own heuristics). Runs
  // once on mount; onCredential below can fire more than once if the
  // visitor retries after a failed follow-up call.
  useEffect(() => {
    if (!googleButtonRef.current) return;
    const container = googleButtonRef.current;

    async function onCredential(idToken: string) {
      setError(null);
      setGoogleProcessing(true);
      try {
        const outcome = await loginWithGoogle(idToken);

        if (outcome.status === "ok") {
          // A staff account already exists for this Google identity (a
          // returning owner) — log straight in instead of re-running signup.
          const me = await getMe(outcome.accessToken);
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
            accessToken: outcome.accessToken,
            refreshToken: outcome.refreshToken,
          });
          navigate("/redirecting", { state: { to: "/dashboard" } });
          return;
        }

        // No staff account matched this Google identity yet — carry the
        // verified idToken through the rest of the wizard. ReceiptPage
        // finishes the job by calling POST /accounts/signup with this same
        // idToken instead of a password, right after checkout completes.
        setGoogleIdentity({
          googleIdToken: idToken,
          fullName: outcome.name,
          workEmail: outcome.email,
        });
        navigate("/signup/business");
      } catch (err) {
        const message =
          err instanceof ApiError || err instanceof Error
            ? err.message
            : "Google sign-up failed. Try again.";
        setError(message);
      } finally {
        setGoogleProcessing(false);
      }
    }

    renderGoogleButton(container, env.VITE_GOOGLE_CLIENT_ID, onCredential, {
      text: "signup_with",
      width: 420,
    }).catch((err) => {
      const message =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Couldn't load Google sign-up right now.";
      setError(message);
    });
    // Intentionally runs once — navigate/loginWithSession/onboarding
    // store actions are all stable references across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !workEmail.trim() || !password) {
      setError("Fill in your name, work email, and a password to continue.");
      return;
    }
    navigate("/signup/business");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-tn-surface px-6 py-12">
      <form onSubmit={handleSubmit} className="flex w-[420px] flex-col gap-6">
        <div>
          <h1 className="m-0 mb-1.5 font-serif text-[28px] font-semibold text-tn-ink">
            Create your owner account
          </h1>
          <p className="m-0 font-sans text-[13px] text-tn-muted-5">Step 1 of 4</p>
        </div>

        <StepProgress step={1} total={4} />

        {/* Google renders its own button here (see google-identity.ts) —
            a real user click on it doesn't have the silent-suppression
            risk a custom button driving One Tap's prompt() used to. */}
        <div ref={googleButtonRef} className="flex justify-center" />
        {googleProcessing && (
          <p className="m-0 -mt-3 text-center font-sans text-xs text-tn-muted-5">
            Finishing Google sign-up…
          </p>
        )}

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-tn-border" />
          <span className="font-sans text-xs text-tn-muted-6">or</span>
          <div className="h-px flex-1 bg-tn-border" />
        </div>

        <div className="flex flex-col gap-3.5">
          <Field label="FULL NAME">
            <input
              type="text"
              placeholder="Sam Whitfield"
              value={fullName}
              onChange={(e) => setAccountDetails({ fullName: e.target.value })}
              className={formInputClass}
            />
          </Field>
          <Field label="WORK EMAIL">
            <input
              type="email"
              placeholder="you@yourshop.com"
              value={workEmail}
              onChange={(e) => setAccountDetails({ workEmail: e.target.value })}
              className={formInputClass}
            />
          </Field>
          <Field label="PASSWORD">
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setAccountDetails({ password: e.target.value })}
              className={formInputClass}
            />
          </Field>
        </div>

        {error && <p className="m-0 font-sans text-xs text-tn-danger">{error}</p>}

        <Button type="submit" size="lg">
          Continue
        </Button>
      </form>
    </div>
  );
}

export default CreateAccountPage;
