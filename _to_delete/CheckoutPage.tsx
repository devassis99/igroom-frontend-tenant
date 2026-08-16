import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useOnboardingStore } from "@/auth/onboarding-store";
import { Button } from "@/components/ui/Button";
import { BILLING_CYCLE_LABEL } from "@/lib/sample-data";
import { centsToDollars } from "@/lib/billing-api";
import { createCheckoutSession } from "@/lib/accounts-api";
import { ApiError } from "@/lib/http";

/**
 * Matches the mockup's T4 Stripe-checkout frame — step 3 of the funnel
 * (Account → Plan → Checkout → Business details).
 *
 * The plan/price shown here is whatever ChoosePlanPage stored in
 * onboarding.selectedPlan — a snapshot of the real igroom-backend price
 * at the moment it was picked (see billing-api.ts), not a locally
 * recomputed discount. "Total due today" is the actual amount charged at
 * this cadence (e.g. the full annual total), matching what Stripe
 * actually bills.
 *
 * "Continue to secure payment" calls POST /accounts/checkout-session
 * (accounts-api.ts) and redirects the browser straight to Stripe's real
 * hosted Checkout page — card entry, Apple Pay/Google Pay, promo codes,
 * all handled by Stripe itself, not re-implemented here. Stripe redirects
 * back to /signup/business?session_id=... once the visitor is done;
 * BusinessDetailsPage passes that session id along to POST
 * /accounts/signup, which verifies it before creating the account. No
 * account exists yet at this point in the funnel, so this page never
 * calls signup() itself.
 */
export function CheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const onboarding = useOnboardingStore();
  const plan = onboarding.selectedPlan;
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canceled = searchParams.get("canceled") === "1";

  useEffect(() => {
    if (!plan) navigate("/signup/plan", { replace: true });
  }, [plan, navigate]);

  if (!plan) return null;

  const price = centsToDollars(plan.priceCents);

  async function handleContinue() {
    if (!plan) return;
    setError(null);
    setRedirecting(true);
    try {
      const session = await createCheckoutSession({
        planKey: plan.key,
        billingCycle: onboarding.billingCycle,
        email: onboarding.workEmail || undefined,
      });
      window.location.href = session.url;
    } catch (err) {
      const message =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Couldn't start checkout — try again.";
      setError(message);
      setRedirecting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-tn-surface px-6 py-12">
      <div className="flex w-full max-w-[900px] overflow-hidden rounded-2xl border border-tn-border-softer">
        <div className="flex flex-1 flex-col gap-6 bg-tn-page p-10">
          <span className="font-sans text-[15px] font-semibold text-tn-muted-2">
            iGroom for Business
          </span>
          <div>
            <p className="m-0 font-sans text-[13px] text-tn-muted-5">Subscribe to</p>
            <p className="m-0 mt-1 font-serif text-2xl font-semibold text-tn-ink">
              {plan.name} Plan
            </p>
            <p className="m-0 mt-2 font-sans text-[34px] font-semibold text-tn-ink">
              ${price}{" "}
              <span className="font-sans text-sm font-normal text-tn-muted-5">
                / {BILLING_CYCLE_LABEL[onboarding.billingCycle].toLowerCase()}
              </span>
            </p>
          </div>
          <div className="flex flex-col gap-2.5 border-t border-tn-border pt-2 font-sans text-[13px] text-tn-muted-3">
            <div className="flex justify-between">
              <span>{plan.name} Plan</span>
              <span>${price}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax</span>
              <span>$0.00</span>
            </div>
            <div className="flex justify-between border-t border-tn-border pt-2 font-sans text-sm font-semibold text-tn-ink">
              <span>Total due today</span>
              <span>${price}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-4 bg-tn-surface p-10">
          <div>
            <p className="m-0 font-sans text-sm font-semibold text-tn-ink">
              Secure checkout via Stripe
            </p>
            <p className="m-0 mt-1.5 font-sans text-[13px] leading-relaxed text-tn-muted-4">
              You'll be taken to Stripe's secure payment page to enter your card (or pay with Apple
              Pay / Google Pay). We never see or store your card details — Stripe handles that
              entirely.
            </p>
          </div>

          {canceled && (
            <p className="m-0 rounded-lg bg-tn-danger-bg px-3 py-2 font-sans text-xs text-tn-danger">
              Checkout was canceled — no charge was made. You can try again whenever you're ready.
            </p>
          )}

          {error && <p className="m-0 font-sans text-xs text-tn-danger">{error}</p>}

          <Button onClick={handleContinue} disabled={redirecting} className="mt-1.5">
            {redirecting ? "Redirecting to Stripe…" : "Continue to secure payment"}
          </Button>
          <p className="m-0 text-center font-sans text-[11px] text-tn-faint">Powered by Stripe</p>
        </div>
      </div>
    </div>
  );
}

export default CheckoutPage;
