import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useOnboardingStore } from "@/auth/onboarding-store";
import { useAuthStore } from "@/auth/auth-store";
import { Button } from "@/components/ui/Button";
import { Field, formInputClass } from "@/components/ui/FormField";
import { BILLING_CYCLE_LABEL, PLAN_TIERS, planPriceForCycle } from "@/lib/sample-data";

/**
 * Matches the mockup's T4 Stripe-checkout frame. Note on pricing: T3b–e's
 * plan cards are flat-fee-per-tier ($30/$50/$150/$250/mo), while T4's own
 * example line-items a *different*, per-seat "Business Plan" ($12/seat ×
 * 4). Carrying the per-seat model through here would silently overwrite
 * the plan the owner just picked, so this checkout totals the selected
 * tier's own flat price instead — the two frames' numbers were never
 * meant to describe the same purchase.
 */
export function CheckoutPage() {
  const navigate = useNavigate();
  const onboarding = useOnboardingStore();
  const completeSignup = useAuthStore((s) => s.completeSignup);

  const plan = PLAN_TIERS.find((p) => p.id === onboarding.planId);

  useEffect(() => {
    if (!plan) navigate("/signup/plan", { replace: true });
  }, [plan, navigate]);

  if (!plan) return null;

  const price = planPriceForCycle(plan.monthly, onboarding.billingCycle);

  function handleSubscribe() {
    if (!plan) return;
    completeSignup({
      fullName: onboarding.fullName || "Sam Whitfield",
      workEmail: onboarding.workEmail,
      businessName: onboarding.businessName || "The Gentry Barbershop",
      category: onboarding.category,
      address: onboarding.address,
      phone: onboarding.phone,
      planId: plan.id,
      planName: plan.name,
      billingCycle: onboarding.billingCycle,
      seats: 4,
    });
    navigate("/signup/submitted");
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
              ${price.toFixed(2)}{" "}
              <span className="font-sans text-sm font-normal text-tn-muted-5">
                / {BILLING_CYCLE_LABEL[onboarding.billingCycle].toLowerCase()}
              </span>
            </p>
          </div>
          <div className="flex flex-col gap-2.5 border-t border-tn-border pt-2 font-sans text-[13px] text-tn-muted-3">
            <div className="flex justify-between">
              <span>{plan.name} Plan</span>
              <span>${price.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax</span>
              <span>$0.00</span>
            </div>
            <div className="flex justify-between border-t border-tn-border pt-2 font-sans text-sm font-semibold text-tn-ink">
              <span>Total due today</span>
              <span>${price.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4 bg-tn-surface p-10">
          <button
            type="button"
            disabled
            title="Illustrative only — this checkout doesn't process real payments."
            className="flex cursor-not-allowed items-center justify-center gap-2.5 rounded-[10px] border border-tn-input-border bg-tn-surface p-[13px] font-sans text-sm font-medium text-tn-ink opacity-60"
          >
            <span className="h-4 w-4 rounded-md bg-tn-ink" aria-hidden />
            Pay with Apple Pay
          </button>
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-tn-border" />
            <span className="font-sans text-xs text-tn-muted-6">Or pay with card</span>
            <div className="h-px flex-1 bg-tn-border" />
          </div>

          <Field label="EMAIL">
            <input
              type="email"
              placeholder="you@yourshop.com"
              defaultValue={onboarding.workEmail}
              className={formInputClass}
            />
          </Field>
          <Field label="CARD INFORMATION">
            <input type="text" placeholder="1234 1234 1234 1234" className={formInputClass} />
          </Field>
          <div className="flex gap-0">
            <input type="text" placeholder="MM / YY" className={`${formInputClass} flex-1`} />
            <input type="text" placeholder="CVC" className={`${formInputClass} flex-1`} />
          </div>
          <Field label="CARDHOLDER NAME">
            <input
              type="text"
              placeholder="Sam Whitfield"
              defaultValue={onboarding.fullName}
              className={formInputClass}
            />
          </Field>

          <Button onClick={handleSubscribe} className="mt-1.5">
            Subscribe
          </Button>
          <p className="m-0 text-center font-sans text-[11px] text-tn-faint">Powered by Stripe</p>
        </div>
      </div>
    </div>
  );
}

export default CheckoutPage;
