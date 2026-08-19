import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useOnboardingStore } from "@/auth/onboarding-store";
import { Button } from "@/components/ui/Button";
import { StepProgress } from "@/components/ui/StepProgress";
import type { AvailabilityDay } from "@/lib/availability-api";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * This step's own lightweight per-day shape — a single on/off toggle plus
 * one time range, editable in place. Converted to the API's
 * `AvailabilityDay[]` (dayOfWeek + a `ranges` array — see
 * availability-api.ts) only at submit time, in toApiDays below: the
 * onboarding step never needs more than one range per day, so there's no
 * "+" add-another-range UI here, just Settings > Availability's fuller
 * editor.
 */
interface LocalDay {
  dayOfWeek: number;
  isEnabled: boolean;
  startTime: string;
  endTime: string;
}

// Sunday off, Monday–Saturday 9–6 — same default spread Settings'
// AddMemberWizard "Schedule" tab shows as sample data (see WEEK there).
const DEFAULT_DAYS: LocalDay[] = DAY_LABELS.map((_, dayOfWeek) => ({
  dayOfWeek,
  isEnabled: dayOfWeek !== 0,
  startTime: "09:00",
  endTime: "18:00",
}));

function toApiDays(days: LocalDay[]): AvailabilityDay[] {
  return days.map((d) => ({
    dayOfWeek: d.dayOfWeek,
    ranges: d.isEnabled ? [{ startTime: d.startTime, endTime: d.endTime }] : [],
  }));
}

/**
 * Step 3 of 4 (Account → Business details → Availability → Plan) — runs
 * before checkout, so there's no staffUser/accessToken yet to call PUT
 * /availability/me with. This page just stashes the picked schedule in
 * the onboarding store (see onboarding-store.ts's availabilityDays);
 * ReceiptPage submits it for real right after signup() succeeds and a
 * real session exists. "Skip for now" stores `null` instead, so
 * ReceiptPage knows not to submit anything. Reuses the same day-toggle +
 * hours pattern as Settings' AddMemberWizard "Schedule" tab (there,
 * still mock-only/static sample data).
 */
export function StaffAvailabilityPage() {
  const navigate = useNavigate();
  const { setAvailabilityDays, setLastRoute } = useOnboardingStore();
  const [days, setDays] = useState<LocalDay[]>(DEFAULT_DAYS);

  // Records "this is the step the visitor is currently on" so a later
  // resume click from LandingPage jumps back here instead of restarting
  // the wizard — see onboarding-store.ts's lastRoute comment.
  useEffect(() => {
    setLastRoute("/signup/availability");
  }, [setLastRoute]);

  function toggleDay(dayOfWeek: number) {
    setDays((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, isEnabled: !d.isEnabled } : d)),
    );
  }

  function updateTime(dayOfWeek: number, field: "startTime" | "endTime", value: string) {
    setDays((prev) => prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, [field]: value } : d)));
  }

  function skip() {
    setAvailabilityDays(null);
    navigate("/signup/plan");
  }

  function saveAndContinue() {
    setAvailabilityDays(toApiDays(days));
    navigate("/signup/plan");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-tn-surface px-6 py-12">
      <div className="flex w-[460px] flex-col gap-[22px]">
        <div>
          <h1 className="m-0 mb-1.5 font-serif text-[28px] font-semibold text-tn-ink">
            Set your weekly availability
          </h1>
          <p className="m-0 font-sans text-[13px] text-tn-muted-5">
            Step 3 of 4 — optional, you can change this later in Settings
          </p>
        </div>

        <StepProgress step={3} total={4} />

        <div className="flex flex-col gap-3 rounded-xl border border-tn-border p-4">
          {days.map((d) => (
            <div key={d.dayOfWeek} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => toggleDay(d.dayOfWeek)}
                aria-pressed={d.isEnabled}
                aria-label={`Toggle ${DAY_LABELS[d.dayOfWeek]}`}
                className={`flex h-[18px] w-[18px] flex-none cursor-pointer items-center justify-center rounded border text-[11px] ${
                  d.isEnabled
                    ? "border-tn-gold bg-tn-gold text-tn-on-dark"
                    : "border-tn-input-border"
                }`}
              >
                {d.isEnabled && "✓"}
              </button>
              <span className="w-24 flex-none font-sans text-[13px] text-tn-ink-soft">
                {DAY_LABELS[d.dayOfWeek]}
              </span>
              {d.isEnabled ? (
                <div className="flex flex-1 items-center gap-2">
                  <input
                    type="time"
                    aria-label={`${DAY_LABELS[d.dayOfWeek]} start time`}
                    value={d.startTime}
                    onChange={(e) => updateTime(d.dayOfWeek, "startTime", e.target.value)}
                    className="rounded-lg border border-tn-input-border bg-tn-surface px-2 py-1 font-sans text-[13px] text-tn-ink outline-none focus:border-2 focus:border-tn-gold"
                  />
                  <span className="font-sans text-xs text-tn-muted-6">to</span>
                  <input
                    type="time"
                    aria-label={`${DAY_LABELS[d.dayOfWeek]} end time`}
                    value={d.endTime}
                    onChange={(e) => updateTime(d.dayOfWeek, "endTime", e.target.value)}
                    className="rounded-lg border border-tn-input-border bg-tn-surface px-2 py-1 font-sans text-[13px] text-tn-ink outline-none focus:border-2 focus:border-tn-gold"
                  />
                </div>
              ) : (
                <span className="font-sans text-[13px] text-tn-faint-2">Off</span>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2.5">
          <Button variant="secondary" className="flex-1" onClick={skip}>
            Skip for now
          </Button>
          <Button className="flex-1" onClick={saveAndContinue}>
            Save & continue
          </Button>
        </div>
      </div>
    </div>
  );
}

export default StaffAvailabilityPage;
