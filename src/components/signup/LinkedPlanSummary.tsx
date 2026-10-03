import { BILLING_CYCLE_LABEL } from "@/lib/sample-data";
import { formatPlanAmount, type SignupLink } from "@/lib/billing-api";

const PER_CYCLE: Record<SignupLink["billingCycle"], string> = {
  monthly: "/ month",
  quarterly: "/ quarter",
  biannual: "/ 6 months",
  annual: "/ year",
};

/**
 * The plan a signup link was sent with — shown on JoinPage before the
 * visitor starts, and on ChoosePlanPage's linked view when they come
 * back from a cancelled checkout. Read-only on purpose: the plan was
 * chosen by whoever sent the link, so there's nothing here to change.
 */
export function LinkedPlanSummary({ link }: { link: SignupLink }) {
  const discount =
    link.discountType && link.discountValue
      ? link.discountType === "percent"
        ? `${link.discountValue}% off`
        : `${formatPlanAmount(link.discountValue, link.currency)} off`
      : null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-tn-border bg-tn-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="m-0 font-sans text-[11px] font-semibold tracking-[0.06em] text-tn-muted-5">
            YOUR PLAN
          </p>
          <p className="m-0 mt-1 font-serif text-[22px] font-semibold text-tn-ink">
            {link.plan.name}
          </p>
          <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">
            {BILLING_CYCLE_LABEL[link.billingCycle]} billing
          </p>
        </div>
        <div className="text-right">
          <p className="m-0 font-sans text-[22px] font-semibold text-tn-ink">
            {formatPlanAmount(link.unitAmount, link.currency)}
          </p>
          <p className="m-0 font-sans text-xs text-tn-muted-5">{PER_CYCLE[link.billingCycle]}</p>
        </div>
      </div>

      {(link.trialDays > 0 || discount) && (
        <div className="flex flex-wrap gap-2">
          {link.trialDays > 0 && (
            <span className="rounded-full bg-tn-success-bg px-2.5 py-1 font-sans text-[11px] font-semibold text-tn-success">
              {link.trialDays}-day free trial
            </span>
          )}
          {discount && (
            <span className="rounded-full bg-tn-gold-bg px-2.5 py-1 font-sans text-[11px] font-semibold text-tn-gold">
              {discount}
            </span>
          )}
        </div>
      )}

      {link.plan.features.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {link.plan.features.map((feature) => (
            <li key={feature} className="flex gap-2 font-sans text-[13px] text-tn-ink">
              <span aria-hidden className="text-tn-gold">
                ✓
              </span>
              {feature}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
