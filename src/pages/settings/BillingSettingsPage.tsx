import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { StatusPill } from "@/components/ui/StatusPill";
import { useAuthStore } from "@/auth/auth-store";
import { BILLING_CYCLE_LABEL, type BillingCycle } from "@/lib/sample-data";

const CYCLES: BillingCycle[] = ["monthly", "quarterly", "biannual", "annual"];

const INVOICES = [
  { date: "Aug 8, 2026", amount: 48.0 },
  { date: "Jul 8, 2026", amount: 48.0 },
  { date: "Jun 8, 2026", amount: 36.0 },
];

/** Matches the mockup's T12g Billing & Plan page. */
export function BillingSettingsPage() {
  const owner = useAuthStore((s) => s.owner);
  const [cycle, setCycle] = useState<BillingCycle>(owner?.billingCycle ?? "monthly");

  return (
    <div className="flex flex-col gap-8">
      <h1 className="m-0 font-sans text-2xl font-semibold text-tn-ink">Billing &amp; Plan</h1>

      <section className="flex flex-col gap-4 rounded-2xl border border-tn-border p-5">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-sans text-xs font-semibold tracking-[0.02em] text-tn-muted-5">
              CURRENT PLAN
            </span>
            <p className="m-0 mt-1 font-serif text-xl font-semibold text-tn-ink">
              {owner?.planName ?? "Business"}
            </p>
            <p className="m-0 mt-1 font-sans text-xs text-tn-muted-5">
              $12/seat/mo · next charge <strong className="text-tn-ink">$48</strong> on Sep 8, 2026
            </p>
          </div>
          <Button variant="secondary" size="sm">
            Change plan
          </Button>
        </div>

        <SegmentedControl
          value={cycle}
          onChange={setCycle}
          options={CYCLES.map((c) => ({
            value: c,
            label: c === "annual" ? `${BILLING_CYCLE_LABEL[c]} -20%` : BILLING_CYCLE_LABEL[c],
          }))}
        />

        <div className="flex items-center justify-between rounded-xl bg-tn-page px-4 py-3">
          <span className="font-sans text-sm font-semibold text-tn-ink">
            4 <span className="font-normal text-tn-muted-4">of 5 seats</span>
          </span>
          <span className="font-sans text-xs font-medium text-tn-gold">1 seat left</span>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="m-0 font-sans text-sm font-semibold text-tn-ink">Payment method</p>
          <Button variant="ghost" size="sm">
            Add card
          </Button>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-tn-border p-4">
          <span className="rounded-md bg-tn-blue-bg px-2 py-1 font-sans text-[11px] font-bold text-tn-blue">
            VISA
          </span>
          <div className="flex-1">
            <p className="m-0 font-sans text-sm font-medium text-tn-ink">•••• 4821</p>
            <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">Expires 09/28</p>
          </div>
          <StatusPill tone="neutral">DEFAULT</StatusPill>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <p className="m-0 font-sans text-sm font-semibold text-tn-ink">Billing history</p>
        <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border">
          {INVOICES.map((inv, i) => (
            <div
              key={inv.date}
              className={`flex items-center justify-between px-5 py-3.5 ${
                i < INVOICES.length - 1 ? "border-b border-tn-border-soft" : ""
              }`}
            >
              <span className="font-sans text-[13px] text-tn-ink-soft">{inv.date}</span>
              <span className="font-sans text-[13px] font-semibold text-tn-ink">
                ${inv.amount.toFixed(2)}
              </span>
              <StatusPill tone="success">Paid</StatusPill>
              <span className="cursor-pointer font-sans text-tn-muted-5" aria-hidden>
                ↓
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default BillingSettingsPage;
