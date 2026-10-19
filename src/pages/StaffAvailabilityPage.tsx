import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { useOnboardingStore, useSignupStep } from "@/auth/onboarding-store";
import { useAfterPaymentGate } from "@/components/signup/after-payment";
import { Button } from "@/components/ui/Button";
import { StepProgress } from "@/components/ui/StepProgress";
import { TimePicker } from "@/components/ui/TimePicker";
import { setMyAvailability, type AvailabilityDay } from "@/lib/availability-api";
import { ApiError } from "@/lib/http";

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
 * The last step — 4 of 4 (Account → Plan → Business details →
 * Availability), or 3 of 3 for an invite link. It comes after payment,
 * so the account exists and the owner is signed in: "Save & continue"
 * puts the schedule straight on them (PUT /availability/me), and "Skip
 * for now" saves nothing. Either way signup is over: the onboarding
 * store is cleared (the receipt was shown right after payment) and the
 * owner goes to their dashboard. Reuses the same day-toggle + hours
 * pattern as Settings' AddMemberWizard "Schedule" tab (there, still
 * mock-only/static sample data).
 */
export function StaffAvailabilityPage() {
  const navigate = useNavigate();
  const gate = useAfterPaymentGate();
  const step = useSignupStep("availability");
  const { setLastRoute, reset } = useOnboardingStore();
  const [days, setDays] = useState<LocalDay[]>(DEFAULT_DAYS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (gate.state === "loading") return null;
  if (gate.state === "redirect") return <Navigate to={gate.to} replace />;
  const { accessToken } = gate;

  // The end of signup — nothing in the wizard is needed again.
  function finish() {
    reset();
    navigate("/redirecting", { state: { to: "/dashboard" }, replace: true });
  }

  function skip() {
    finish();
  }

  async function saveAndContinue() {
    setError(null);
    setSaving(true);
    try {
      await setMyAvailability(accessToken, toApiDays(days));
      finish();
    } catch (err) {
      setError(
        err instanceof ApiError || err instanceof Error
          ? `${err.message} — you can skip this and set your hours later in Settings.`
          : "Couldn't save your hours — you can skip this and set them later in Settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-tn-surface px-6 py-12">
      <div className="flex w-[460px] flex-col gap-[22px]">
        <div>
          <h1 className="m-0 mb-1.5 font-sans text-[24px] font-semibold text-tn-ink">
            Set your weekly availability
          </h1>
          <p className="m-0 font-sans text-[14px] text-tn-muted-5">
            Step {step.number} of {step.total} — optional, you can change this later in Settings
          </p>
        </div>

        <StepProgress step={step.number} total={step.total} />

        <div className="flex flex-col gap-3 rounded-xl border border-tn-border p-4">
          {days.map((d) => (
            <div key={d.dayOfWeek} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => toggleDay(d.dayOfWeek)}
                aria-pressed={d.isEnabled}
                aria-label={`Toggle ${DAY_LABELS[d.dayOfWeek]}`}
                className={`flex h-[18px] w-[18px] flex-none cursor-pointer items-center justify-center rounded border text-[12px] ${
                  d.isEnabled
                    ? "border-tn-gold bg-tn-gold text-tn-on-dark"
                    : "border-tn-input-border"
                }`}
              >
                {d.isEnabled && "✓"}
              </button>
              <span className="w-24 flex-none font-sans text-[14px] text-tn-ink-soft">
                {DAY_LABELS[d.dayOfWeek]}
              </span>
              {d.isEnabled ? (
                <div className="flex flex-1 items-center gap-2">
                  <TimePicker
                    label={`${DAY_LABELS[d.dayOfWeek]} start time`}
                    value={d.startTime}
                    onChange={(next) => updateTime(d.dayOfWeek, "startTime", next)}
                    // `!` on width, not just padding/text — TimePicker's own trigger
                    // button is `w-full` by default, and an un-!'d `w-[132px]` here
                    // loses that specificity fight (Tailwind resolves a tie between
                    // two single-class selectors by stylesheet order, not by where
                    // the class sits in this string) — that's what made this field
                    // balloon to fill its row instead of staying a compact 132px.
                    className="!w-[132px] !px-2.5 !py-1.5 !text-[14px]"
                  />
                  <span className="font-sans text-xs text-tn-muted-6">to</span>
                  <TimePicker
                    label={`${DAY_LABELS[d.dayOfWeek]} end time`}
                    value={d.endTime}
                    onChange={(next) => updateTime(d.dayOfWeek, "endTime", next)}
                    className="!w-[132px] !px-2.5 !py-1.5 !text-[14px]" // see the start TimePicker's comment above
                  />
                </div>
              ) : (
                <span className="font-sans text-[14px] text-tn-faint-2">Off</span>
              )}
            </div>
          ))}
        </div>

        {error && <p className="m-0 font-sans text-xs text-tn-danger">{error}</p>}

        <div className="flex gap-2.5">
          <Button variant="secondary" className="flex-1" onClick={skip} disabled={saving}>
            Skip for now
          </Button>
          <Button className="flex-1" onClick={() => void saveAndContinue()} disabled={saving}>
            {saving ? "Saving…" : "Save & continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default StaffAvailabilityPage;
