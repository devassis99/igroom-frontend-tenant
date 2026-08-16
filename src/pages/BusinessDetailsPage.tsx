import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useOnboardingStore } from "@/auth/onboarding-store";
import { useAuthStore } from "@/auth/auth-store";
import { Button } from "@/components/ui/Button";
import { Field, formInputClass } from "@/components/ui/FormField";
import { StepProgress } from "@/components/ui/StepProgress";
import { signup } from "@/lib/accounts-api";
import { ApiError } from "@/lib/http";

const CATEGORIES = ["Barbershop", "Hair Salon", "Nails", "Spa"];

/**
 * Matches the mockup's T3 "Tell us about your business" frame — step 3
 * of 3, the last data-collection step in the funnel (Account → Plan →
 * Business details). Everything else the real signup needs (owner
 * credentials, chosen plan/price — see onboarding.selectedPlan from
 * billing-api.ts) is already sitting in the onboarding store by the
 * time a visitor reaches this page, so this page's Continue button is
 * what actually calls POST /accounts/signup — creating the account, its
 * primary location, and the owner.
 *
 * Stripe redirects here (accounts.service.ts's checkout success_url)
 * with ?session_id=... once the visitor finishes paying — that id is
 * read below and sent along to signup(), which verifies it server-side
 * before creating the account. Landing here without one (e.g. a
 * bookmarked link, or navigating back) means checkout was never
 * completed, so the visitor is sent back to ChoosePlanPage to pay first
 * rather than letting Continue submit without a real session id.
 */
export function BusinessDetailsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const stripeCheckoutSessionId = searchParams.get("session_id");
  const onboarding = useOnboardingStore();
  const { businessName, category, address, phone, setBusinessDetails } = onboarding;
  const loginWithSession = useAuthStore((s) => s.loginWithSession);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const plan = onboarding.selectedPlan;

  useEffect(() => {
    if (!plan) navigate("/signup/plan", { replace: true });
    else if (!stripeCheckoutSessionId) navigate("/signup/plan", { replace: true });
  }, [plan, stripeCheckoutSessionId, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!businessName.trim() || !address.trim() || !phone.trim()) {
      setError("Fill in your business name, address, and phone to continue.");
      return;
    }
    if (!plan || !stripeCheckoutSessionId) return;

    setError(null);
    setSubmitting(true);
    try {
      const tokens = await signup({
        fullName: onboarding.fullName || "Sam Whitfield",
        workEmail: onboarding.workEmail,
        password: onboarding.googleIdToken ? undefined : onboarding.password,
        googleIdToken: onboarding.googleIdToken ?? undefined,
        businessName,
        category,
        address,
        phone,
        planKey: plan.key,
        billingCycle: onboarding.billingCycle,
        stripeCheckoutSessionId,
      });

      loginWithSession({
        owner: {
          fullName: onboarding.fullName || "Sam Whitfield",
          workEmail: onboarding.workEmail,
          businessName,
          category,
          address,
          phone,
          planKey: plan.key,
          planName: plan.name,
          priceCents: plan.priceCents,
          currency: plan.currency,
          billingCycle: onboarding.billingCycle,
          seats: 4,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
      // Signup is done — clear the sessionStorage-persisted wizard state
      // (see onboarding-store.ts) so a later visit to /signup doesn't
      // resurrect this finished attempt's email/plan/etc. signup()
      // already created an active/trialing account and loginWithSession
      // above already set a real session, so there's no pending-review
      // gate to wait on — go straight into the app.
      onboarding.reset();
      navigate("/dashboard");
    } catch (err) {
      const message =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Something went wrong completing signup. Try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!plan || !stripeCheckoutSessionId) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-tn-surface px-6 py-12">
      <form onSubmit={handleSubmit} className="flex w-[460px] flex-col gap-[22px]">
        <div>
          <h1 className="m-0 mb-1.5 font-serif text-[28px] font-semibold text-tn-ink">
            Tell us about your business
          </h1>
          <p className="m-0 font-sans text-[13px] text-tn-muted-5">Step 3 of 3</p>
        </div>

        <StepProgress step={3} total={3} />

        <Field label="BUSINESS NAME">
          <input
            type="text"
            placeholder="The Gentry Barbershop"
            value={businessName}
            onChange={(e) => setBusinessDetails({ businessName: e.target.value })}
            className={formInputClass}
          />
        </Field>

        <div className="flex flex-col gap-2">
          <span className="font-sans text-xs font-medium tracking-[0.02em] text-tn-muted-1">
            CATEGORY
          </span>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setBusinessDetails({ category: c })}
                className={`rounded-full px-4 py-2 font-sans text-[13px] font-medium ${
                  category === c ? "bg-tn-dark text-tn-on-dark" : "bg-tn-page text-tn-dark"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <Field label="ADDRESS">
          <input
            type="text"
            placeholder="412 Congress Ave, Austin, TX"
            value={address}
            onChange={(e) => setBusinessDetails({ address: e.target.value })}
            className={formInputClass}
          />
        </Field>

        <Field label="BUSINESS PHONE">
          <input
            type="tel"
            placeholder="(512) 555-0100"
            value={phone}
            onChange={(e) => setBusinessDetails({ phone: e.target.value })}
            className={formInputClass}
          />
        </Field>

        {error && <p className="m-0 font-sans text-xs text-tn-danger">{error}</p>}

        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? "Creating your account…" : "Continue"}
        </Button>
      </form>
    </div>
  );
}

export default BusinessDetailsPage;
