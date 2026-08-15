import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { useOnboardingStore } from "@/auth/onboarding-store";
import { Button } from "@/components/ui/Button";
import { Field, formInputClass } from "@/components/ui/FormField";
import { StepProgress } from "@/components/ui/StepProgress";

/** Matches the mockup's T2 "Create your owner account" frame, step 1 of 2. */
export function CreateAccountPage() {
  const navigate = useNavigate();
  const { fullName, workEmail, password, setAccountDetails } = useOnboardingStore();
  const [error, setError] = useState<string | null>(null);

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
          <p className="m-0 font-sans text-[13px] text-tn-muted-5">Step 1 of 2</p>
        </div>

        <StepProgress step={1} total={2} />

        <button
          type="button"
          disabled
          title="Google sign-up isn't wired up yet — igroom-backend has no tenant auth endpoints. Use the form below."
          className="flex cursor-not-allowed items-center justify-center gap-2.5 rounded-xl border border-tn-input-border bg-tn-surface p-3.5 font-sans text-[15px] font-medium text-tn-ink opacity-60"
        >
          <span className="h-4 w-4 rounded-full border-2 border-tn-ink" aria-hidden />
          Sign up with Google
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
