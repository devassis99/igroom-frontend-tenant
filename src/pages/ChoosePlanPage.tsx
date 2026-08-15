import { useNavigate } from "react-router";
import { useOnboardingStore } from "@/auth/onboarding-store";
import {
  BILLING_CYCLE_LABEL,
  PLAN_TIERS,
  planPriceForCycle,
  type BillingCycle,
} from "@/lib/sample-data";

const CYCLES: BillingCycle[] = ["monthly", "quarterly", "biannual", "annual"];

const CYCLE_SUBTITLE: Record<BillingCycle, string> = {
  monthly: "",
  quarterly: " · billed quarterly",
  biannual: " · billed every 6 months",
  annual: " · billed annually",
};

/** Matches the mockup's T3b–T3e "Choose your plan" frames — one page, billing cycle as a tab. */
export function ChoosePlanPage() {
  const navigate = useNavigate();
  const { billingCycle, setBillingCycle, selectPlan } = useOnboardingStore();

  function handleSelect(planId: string) {
    selectPlan(planId);
    navigate("/signup/checkout");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-tn-plan-bg px-6 py-14">
      <div className="text-center">
        <h1 className="m-0 mb-1.5 font-serif text-[30px] font-semibold text-tn-on-dark">
          Choose your plan
        </h1>
        <p className="m-0 font-sans text-sm text-tn-page/80">
          Step 2 of 2 · billed per chair, cancel anytime{CYCLE_SUBTITLE[billingCycle]}
        </p>
      </div>

      <div className="flex gap-0.5 rounded-full bg-tn-plan-track p-[3px]">
        {CYCLES.map((cycle) => (
          <button
            key={cycle}
            type="button"
            onClick={() => setBillingCycle(cycle)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-[7px] font-sans text-xs ${
              cycle === billingCycle
                ? "font-semibold text-tn-ink bg-tn-gold-soft"
                : "font-medium text-tn-page/80"
            }`}
          >
            {BILLING_CYCLE_LABEL[cycle]}
            {cycle === "annual" && (
              <span className="rounded-full bg-tn-gold-bg px-1.5 py-0.5 font-sans text-[9px] font-semibold text-tn-gold">
                SAVE 20%
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-5">
        {PLAN_TIERS.map((plan, i) => {
          const price = planPriceForCycle(plan.monthly, billingCycle);
          const isTrial = i === 0;
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => handleSelect(plan.id)}
              className={`flex w-[220px] flex-col rounded-2xl p-1.5 text-left ${
                isTrial ? "bg-tn-gold-soft" : "bg-tn-surface"
              }`}
            >
              {isTrial ? (
                <p className="m-0 px-3.5 py-2 font-sans text-[11px] font-bold tracking-[0.04em] text-[oklch(28%_0.06_60)]">
                  14-DAY FREE TRIAL
                </p>
              ) : (
                <div className="h-[29px]" />
              )}
              <div
                className={`flex flex-1 flex-col gap-3.5 rounded-xl p-[22px_18px] ${isTrial ? "bg-tn-surface" : ""}`}
              >
                <p className="m-0 font-sans text-xs font-bold tracking-[0.03em] text-tn-dark">
                  {plan.name.toUpperCase()}
                </p>
                <p className="m-0 font-sans text-[34px] font-bold text-tn-ink">
                  ${price}
                  <span className="font-sans text-sm font-normal text-tn-muted-5">/mo</span>
                </p>
                <div className="h-px bg-tn-border-softer" />
                <p className="m-0 whitespace-pre-line font-sans text-xs leading-relaxed text-tn-muted-4">
                  {plan.blurb}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ChoosePlanPage;
