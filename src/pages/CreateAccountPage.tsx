import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { useOnboardingStore } from "@/auth/onboarding-store";
import { useAuthStore } from "@/auth/auth-store";
import { Button } from "@/components/ui/Button";
import { Field, formInputClass } from "@/components/ui/FormField";
import { StepProgress } from "@/components/ui/StepProgress";
import { signInWithGoogle } from "@/lib/google-identity";
import { getMe, loginWithGoogle } from "@/lib/accounts-api";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/http";

/**
 * Matches the mockup's T2 "Create your owner account" frame — step 1 of
 * the 4-step funnel: Account → Plan → Checkout → Business details (see
 * BusinessDetailsPage's comment for why business details now comes
 * last).
 */
export function CreateAccountPage() {
  const navigate = useNavigate();
  const { fullName, workEmail, password, setAccountDetails, setGoogleIdentity } =
    useOnboardingStore();
  const loginWithSession = useAuthStore((s) => s.loginWithSession);
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !workEmail.trim() || !password) {
      setError("Fill in your name, work email, and a password to continue.");
      return;
    }
    navigate("/signup/plan");
  }

  async function handleGoogleSignUp() {
    setError(null);
    setGoogleLoading(true);
    try {
      const idToken = await signInWithGoogle(env.VITE_GOOGLE_CLIENT_ID);
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
        navigate("/dashboard");
        return;
      }

      // No staff account matched this Google identity yet — carry the
      // verified idToken through the rest of the wizard. BusinessDetailsPage's
      // Continue button (the last step) finishes the job by calling
      // POST /accounts/signup with this same idToken instead of a password.
      setGoogleIdentity({
        googleIdToken: idToken,
        fullName: outcome.name,
        workEmail: outcome.email,
      });
      navigate("/signup/plan");
    } catch (err) {
      const message =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Google sign-up failed. Try again.";
      setError(message);
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-tn-surface px-6 py-12">
      <form onSubmit={handleSubmit} className="flex w-[420px] flex-col gap-6">
        <div>
          <h1 className="m-0 mb-1.5 font-serif text-[28px] font-semibold text-tn-ink">
            Create your owner account
          </h1>
          <p className="m-0 font-sans text-[13px] text-tn-muted-5">Step 1 of 3</p>
        </div>

        <StepProgress step={1} total={3} />

        <button
          type="button"
          onClick={handleGoogleSignUp}
          disabled={googleLoading}
          className="flex cursor-pointer items-center justify-center gap-2.5 rounded-xl border border-tn-input-border bg-tn-surface p-3.5 font-sans text-[15px] font-medium text-tn-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4818h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.8741 2.6836-6.6154z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.4673-.8059 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.8591-3.0477.8591-2.3441 0-4.3282-1.5831-5.0359-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.9641 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.9573A8.9965 8.9965 0 000 9c0 1.4523.3477 2.8268.9573 4.0418l3.0068-2.3318z"
            />
            <path
              fill="#EA4335"
              d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5814-2.5814C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582l3.0068 2.3318C4.6718 5.1627 6.6559 3.5795 9 3.5795z"
            />
          </svg>
          {googleLoading ? "Waiting for Google…" : "Sign up with Google"}
        </button>

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
