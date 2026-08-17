import { useState } from "react";
import { Link } from "react-router";
import { useAuthStore } from "@/auth/auth-store";
import { StepProgress } from "@/components/ui/StepProgress";
import { getLaunchChecklistSteps } from "@/lib/launch-checklist";

/**
 * Dashboard's "Getting Started" card — the Home-page onboarding checklist a
 * shop owner sees while setting iGroom up (services, staff, hours,
 * payments, reminders, first booking). Stays visible even once every step
 * is done — a finished checklist with everything struck through is itself
 * useful confirmation that the shop is fully live, not just a signal to
 * hide. See lib/launch-checklist.ts for how each step's `done` flag is
 * derived.
 */
export function LaunchChecklistCard() {
  const owner = useAuthStore((s) => s.owner);
  const steps = getLaunchChecklistSteps();
  const completedCount = steps.filter((step) => step.done).length;
  const allDone = completedCount === steps.length;
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-tn-border bg-tn-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex max-w-md flex-col gap-2">
          <span className="w-fit rounded-full bg-tn-gold-bg px-3 py-1 font-sans text-[11px] font-semibold tracking-[0.02em] text-tn-gold">
            Getting Started
          </span>
          <h2 className="m-0 font-serif text-xl font-semibold text-tn-ink">
            {allDone
              ? `${owner?.businessName ?? "Your shop"} is ready to take bookings`
              : `Get ${owner?.businessName ?? "your shop"} ready to take bookings`}
          </h2>
          <p className="m-0 font-sans text-sm leading-relaxed text-tn-muted-4">
            {allDone
              ? "Every setup step is done — clients can find your services, book with your team, and pay online."
              : "Finish these steps to turn iGroom into your shop's full booking system — services, staff, payments, and reminders, all in one place."}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-[200px]">
          <div className="flex items-center justify-between font-sans text-xs font-semibold text-tn-muted-5">
            <span>Your progress</span>
            <span>
              {completedCount}/{steps.length}
            </span>
          </div>
          <StepProgress step={completedCount} total={steps.length} />
        </div>
      </div>

      <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border">
        {steps.map((step, i) => {
          const isOpen = openId === step.id;
          return (
            <div
              key={step.id}
              className={`flex flex-col ${i < steps.length - 1 ? "border-b border-tn-border-soft" : ""}`}
            >
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : step.id)}
                aria-expanded={isOpen}
                className="flex w-full cursor-pointer items-center gap-3 border-none bg-transparent px-[18px] py-3.5 text-left"
              >
                <span
                  aria-hidden
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-sans text-[11px] ${
                    step.done
                      ? "bg-tn-success text-tn-on-dark"
                      : "border-2 border-tn-border-softer text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span
                  className={`flex-1 font-sans text-[13px] font-semibold ${
                    step.done ? "text-tn-muted-6 line-through" : "text-tn-ink"
                  }`}
                >
                  {step.title}
                </span>
                <span
                  aria-hidden
                  className={`font-sans text-xs text-tn-muted-5 transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                >
                  ⌄
                </span>
              </button>

              {isOpen && (
                <div className="flex items-center justify-between gap-4 py-0.5 pr-[18px] pb-4 pl-11">
                  <p className="m-0 font-sans text-xs leading-relaxed text-tn-muted-5">
                    {step.description}
                  </p>
                  <Link
                    to={step.ctaTo}
                    className="shrink-0 font-sans text-[13px] font-medium whitespace-nowrap text-tn-gold"
                  >
                    {step.ctaLabel} →
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default LaunchChecklistCard;
