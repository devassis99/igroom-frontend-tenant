import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuthStore } from "@/auth/auth-store";
import { Button } from "@/components/ui/Button";
import { BILLING_CYCLE_LABEL, PLAN_TIERS, planPriceForCycle } from "@/lib/sample-data";

/** Matches the mockup's T5 "Application Submitted" frame — receipt + hand-off into the app. */
export function ApplicationSubmittedPage() {
  const navigate = useNavigate();
  const owner = useAuthStore((s) => s.owner);

  useEffect(() => {
    if (!owner) navigate("/signup", { replace: true });
  }, [owner, navigate]);

  if (!owner) return null;

  const plan = PLAN_TIERS.find((p) => p.id === owner.planId);
  const price = plan ? planPriceForCycle(plan.monthly, owner.billingCycle) : 0;
  const firstName = owner.fullName.split(" ")[0];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-tn-surface px-6 py-12 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-tn-success-bg">
        <span className="font-sans text-4xl text-tn-success">✓</span>
      </div>
      <h1 className="m-0 font-serif text-[30px] font-semibold text-tn-ink">
        You&rsquo;re all set, {firstName}
      </h1>
      <p className="m-0 max-w-md font-sans text-[15px] leading-relaxed text-tn-muted-4">
        We&rsquo;re reviewing {owner.businessName}&rsquo;s application. This usually takes less
        than 24 hours — we&rsquo;ll email you once you&rsquo;re live.
      </p>

      <div className="mt-2 flex w-[380px] flex-col gap-3 rounded-2xl border border-tn-border p-5 text-left">
        <div className="flex items-center justify-between">
          <p className="m-0 font-sans text-sm font-semibold text-tn-ink">Receipt</p>
          <span className="cursor-pointer font-sans text-xs font-medium text-tn-gold">
            Download PDF
          </span>
        </div>
        <div className="flex flex-col gap-1.5 border-b border-tn-border-soft pb-2.5 font-sans text-[13px] text-tn-muted-3">
          <div className="flex justify-between">
            <span>Invoice #</span>
            <span>INV-100482</span>
          </div>
          <div className="flex justify-between">
            <span>Plan</span>
            <span>
              {owner.planName} · {BILLING_CYCLE_LABEL[owner.billingCycle]}
            </span>
          </div>
        </div>
        <div className="flex justify-between font-sans text-sm font-semibold text-tn-ink">
          <span>Total paid</span>
          <span>${price.toFixed(2)}</span>
        </div>
      </div>

      <Button size="lg" onClick={() => navigate("/dashboard")} className="mt-2">
        Go to Owner Dashboard
      </Button>
    </div>
  );
}

export default ApplicationSubmittedPage;
