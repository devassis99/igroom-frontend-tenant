import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/auth/auth-store";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { AddOverrideModal } from "@/components/availability/AddOverrideModal";
import { SuccessToast } from "@/components/ui/Toast";
import { CopyTimesPopover } from "@/components/ui/CopyTimesPopover";
import { TimezonePicker } from "@/components/ui/TimezonePicker";
import { TimePicker } from "@/components/ui/TimePicker";
import {
  getStaffAvailability,
  setStaffAvailability,
  addStaffOverride,
  removeStaffOverride,
  type AvailabilityDay,
  type AvailabilityOverride,
  type UpsertOverrideInput,
} from "@/lib/availability-api";

export const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
// The reference page lists Monday first and Sunday last — dayOfWeek
// values underneath still follow JS Date#getDay() (0 = Sunday, matching
// every other place this app stores a weekday), only the on-screen row
// order is reshuffled to match.
export const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

interface EditableRange {
  startTime: string;
  endTime: string;
}

type WeeklyState = Record<number, EditableRange[]>;

function emptyWeek(): WeeklyState {
  const week: WeeklyState = {};
  for (let d = 0; d < 7; d++) week[d] = [];
  return week;
}

function toWeeklyState(days: AvailabilityDay[]): WeeklyState {
  const week = emptyWeek();
  for (const day of days) {
    week[day.dayOfWeek] = day.ranges.map((r) => ({ startTime: r.startTime, endTime: r.endTime }));
  }
  return week;
}

/** "09:30" -> 570 — lets two ranges compare as plain numbers instead of doing string time-math. */
function toMinutes(hhmm: string): number {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * True if `a` and `b` overlap OR are merely back-to-back (one ends exactly
 * when the other starts) — matches availability.service.ts's setAvailability,
 * which rejects both the same way server-side (a staff member can't be
 * "available" in two ranges that touch with no gap; that's just one range
 * split in two for no reason). Order of `a`/`b` doesn't matter.
 */
function rangesConflict(a: EditableRange, b: EditableRange): boolean {
  const aStart = toMinutes(a.startTime);
  const aEnd = toMinutes(a.endTime);
  const bStart = toMinutes(b.startTime);
  const bEnd = toMinutes(b.endTime);
  return (aStart < bEnd && bStart < aEnd) || aEnd === bStart || bEnd === aStart;
}

/**
 * Flags index i whenever it conflicts with an *earlier* range in the same
 * day — not every conflicting range — so a conflicting pair only shows the
 * "aren't permitted" message once, under the later of the two, rather than
 * duplicating it under both.
 */
function computeRangeConflicts(ranges: EditableRange[]): boolean[] {
  return ranges.map((range, i) =>
    ranges.slice(0, i).some((earlier) => rangesConflict(range, earlier)),
  );
}

/** iso is "YYYY-MM-DD" — parsed as local calendar fields, not through Date's UTC-based ISO parsing, so it never off-by-one's across a timezone boundary. */
function formatOverrideDate(iso: string): string {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export interface StaffAvailabilityEditorProps {
  /** Whose schedule this is. The caller decides who that is (self, a filter pick, a location's roster). */
  staffUserId: string;
  /**
   * Second link in the timezone fallback chain, after the schedule's own
   * saved zone: the timezone of the location this member is being viewed
   * under. Null when the caller can't resolve one — the browser's zone is
   * then the last resort.
   */
  locationTimezone?: string | null;
  /** Heading above the weekly grid. "Set your availability" reads wrong when an owner is editing somebody else's week. */
  heading?: string;
}

/**
 * One staff member's working hours: the weekly grid (a day on/off toggle
 * and one or more time ranges per day, with copy-to-other-days), the
 * schedule's timezone, and the date-specific overrides beside it.
 *
 * Extracted from HoursSettingsPage so the same editor backs both places
 * a schedule can be reached from — Settings › Availability (pick anyone
 * in the account) and a location's Availability tab (pick anyone on that
 * shop's roster). They differ only in how the staff member is chosen, so
 * everything downstream of "which staffUserId" lives here and the two
 * callers stay thin.
 *
 * Owns its own fetch/save: switching `staffUserId` re-seeds the form from
 * the newly fetched schedule and discards unsaved edits, which is the
 * behaviour you want when the thing you changed is *who* you're looking
 * at.
 */
export function StaffAvailabilityEditor({
  staffUserId,
  locationTimezone = null,
  heading = "Set your availability",
}: StaffAvailabilityEditorProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const [weekly, setWeekly] = useState<WeeklyState>(emptyWeek());
  // null until the seeding effect below runs at least once — rendered as
  // "Loading…" (same as the rest of the page) rather than guessing at a
  // default before we actually know the location/browser fallback.
  const [timezone, setTimezone] = useState<string | null>(null);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideToDelete, setOverrideToDelete] = useState<AvailabilityOverride | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const availabilityQuery = useQuery({
    queryKey: ["availability", staffUserId],
    queryFn: () => getStaffAvailability(accessToken ?? "", staffUserId),
    enabled: !!accessToken && !!staffUserId,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (availabilityQuery.data) {
      setWeekly(toWeeklyState(availabilityQuery.data.weeklySchedule));
    }
  }, [availabilityQuery.data]);

  // Fallback chain: this schedule's own saved timezone (staff_availability_settings)
  // → the viewed staff member's location timezone → the browser's local
  // zone, so the picker never comes up pointed at nothing. Re-seeds
  // (discarding any unsaved pick) whenever the fetched schedule or the
  // resolved location timezone changes — same "switching who you're
  // viewing resets the form" behavior the `weekly` effect above already
  // has.
  useEffect(() => {
    if (!availabilityQuery.data) return;
    setTimezone(
      availabilityQuery.data.timezone ??
        locationTimezone ??
        Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  }, [availabilityQuery.data, locationTimezone]);

  // Per-day "does range i conflict with an earlier range that same day"
  // flags — drives the inline "Overlapping or consecutive slots aren't
  // permitted" messages below, and gates the Save button so a conflict
  // never even reaches setAvailability's own server-side version of this
  // same check (see availability.service.ts).
  const weeklyConflicts = useMemo(() => {
    const conflicts: Record<number, boolean[]> = {};
    for (let d = 0; d < 7; d++) conflicts[d] = computeRangeConflicts(weekly[d] ?? []);
    return conflicts;
  }, [weekly]);
  const hasConflicts = Object.values(weeklyConflicts).some((flags) => flags.some(Boolean));

  /**
   * Everything that changes when a schedule is saved. The two location
   * views read the same underlying hours through different queries —
   * "No hours set" on a location's Staff tab and the "setup incomplete"
   * line on the locations list both come from staff availability — so a
   * save made from the location Availability tab has to knock those out
   * too, or the badge next door keeps claiming the person has no hours.
   */
  function invalidateAvailabilityViews() {
    queryClient.invalidateQueries({ queryKey: ["availability", staffUserId] });
    queryClient.invalidateQueries({ queryKey: ["staff-performance"] });
    queryClient.invalidateQueries({ queryKey: ["locations"] });
    queryClient.invalidateQueries({ queryKey: ["location-staff"] });
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const days: AvailabilityDay[] = Array.from({ length: 7 }, (_, dayOfWeek) => ({
        dayOfWeek,
        ranges: weekly[dayOfWeek] ?? [],
      }));
      return setStaffAvailability(accessToken ?? "", staffUserId, days, timezone);
    },
    onSuccess: () => {
      invalidateAvailabilityViews();
      setSaveError(null);
      setToast("Availability saved");
    },
    onError: (err) => {
      setSaveError(err instanceof Error ? err.message : "Couldn't save — try again.");
    },
  });

  const addOverrideMutation = useMutation({
    mutationFn: (input: UpsertOverrideInput) =>
      addStaffOverride(accessToken ?? "", staffUserId, input),
    onSuccess: () => {
      invalidateAvailabilityViews();
      setOverrideModalOpen(false);
    },
  });

  const removeOverrideMutation = useMutation({
    mutationFn: (overrideId: string) =>
      removeStaffOverride(accessToken ?? "", staffUserId, overrideId),
    onSuccess: () => {
      invalidateAvailabilityViews();
      setOverrideToDelete(null);
    },
  });

  function toggleDay(dayOfWeek: number) {
    setWeekly((prev) => {
      const isOn = (prev[dayOfWeek] ?? []).length > 0;
      return { ...prev, [dayOfWeek]: isOn ? [] : [{ startTime: "09:00", endTime: "18:00" }] };
    });
  }

  function updateRange(
    dayOfWeek: number,
    index: number,
    field: "startTime" | "endTime",
    value: string,
  ) {
    setWeekly((prev) => ({
      ...prev,
      [dayOfWeek]: (prev[dayOfWeek] ?? []).map((r, i) =>
        i === index ? { ...r, [field]: value } : r,
      ),
    }));
  }

  function addRange(dayOfWeek: number) {
    setWeekly((prev) => {
      const ranges = prev[dayOfWeek] ?? [];
      const last = ranges[ranges.length - 1];
      return {
        ...prev,
        [dayOfWeek]: [...ranges, { startTime: last?.endTime ?? "09:00", endTime: "18:00" }],
      };
    });
  }

  function removeRange(dayOfWeek: number, index: number) {
    setWeekly((prev) => ({
      ...prev,
      [dayOfWeek]: (prev[dayOfWeek] ?? []).filter((_, i) => i !== index),
    }));
  }

  /**
   * Copies one day's ranges onto the days picked in CopyTimesPopover —
   * client-side only until Save Changes is pressed.
   *
   * Ranges are cloned per target rather than shared, so editing Tuesday's
   * copy afterwards doesn't silently rewrite Wednesday's too.
   *
   * This replaces the old copy-to-every-other-day button. Overwriting six
   * days on a single click was destructive with no undo: a shop with
   * different weekend hours lost them the moment anyone copied a weekday,
   * and the only way back was retyping them.
   */
  function copyTimesTo(sourceDay: number, targetDays: number[]) {
    const ranges = weekly[sourceDay] ?? [];
    setWeekly((prev) => {
      const next = { ...prev };
      for (const day of targetDays) {
        if (day === sourceDay) continue;
        next[day] = ranges.map((r) => ({ ...r }));
      }
      return next;
    });
  }

  const overrides = availabilityQuery.data?.overrides ?? [];

  if (availabilityQuery.isError) {
    return (
      <p className="m-0 font-sans text-sm text-tn-danger">
        Couldn&rsquo;t load this schedule — try again.
      </p>
    );
  }

  return (
    // tn-content-in replays whenever a caller's key changes the staff
    // member being edited — see LocationAvailabilityTab / HoursSettingsPage.
    <div className="tn-content-in flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <section className="flex flex-col gap-1 rounded-2xl border border-tn-border p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="m-0 font-sans text-sm font-semibold text-tn-ink">{heading}</p>
            {timezone && (
              <TimezonePicker
                value={timezone}
                onChange={setTimezone}
                label={
                  locationTimezone
                    ? "Timezone"
                    : "Timezone (no location timezone set — defaulted to your browser's)"
                }
              />
            )}
          </div>

          {DISPLAY_ORDER.map((dayOfWeek, i) => {
            const ranges = weekly[dayOfWeek] ?? [];
            const isOn = ranges.length > 0;
            return (
              <div
                key={dayOfWeek}
                className={`flex items-start gap-3 py-3.5 ${
                  i < DISPLAY_ORDER.length - 1 ? "border-b border-tn-border-soft" : ""
                }`}
              >
                <button
                  type="button"
                  role="switch"
                  aria-checked={isOn}
                  aria-label={`Toggle ${DAY_LABELS[dayOfWeek]}`}
                  onClick={() => toggleDay(dayOfWeek)}
                  // Matches ui/Toggle.tsx — see the colour note there.
                  className={`relative mt-0.5 h-[22px] w-9 flex-none cursor-pointer rounded-full border-none transition-colors ${
                    isOn ? "bg-tn-success" : "bg-tn-border-softer"
                  }`}
                >
                  {/* See ui/Toggle.tsx on why `left-0.5` matters here. */}
                  <span
                    className={`absolute top-0.5 left-0.5 h-[18px] w-[18px] rounded-full bg-tn-surface transition-transform ${
                      isOn ? "translate-x-[14px]" : "translate-x-0"
                    }`}
                  />
                </button>
                <span className="w-24 flex-none pt-0.5 font-sans text-[13px] font-medium text-tn-ink-soft">
                  {DAY_LABELS[dayOfWeek]}
                </span>

                {isOn ? (
                  <div className="flex flex-1 flex-col gap-2">
                    {ranges.map((range, index) => {
                      const conflicts = weeklyConflicts[dayOfWeek]?.[index] ?? false;
                      return (
                        <div key={index} className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <TimePicker
                              label={`${DAY_LABELS[dayOfWeek]} range ${index + 1} start`}
                              value={range.startTime}
                              onChange={(next) => updateRange(dayOfWeek, index, "startTime", next)}
                              // `!` on width too, not just padding/text — TimePicker's own
                              // trigger button is `w-full` by default, and an un-!'d
                              // `w-[132px]` here loses that specificity fight (both are
                              // single-class selectors; Tailwind resolves ties by
                              // stylesheet order, not by where the class sits in this
                              // string), which is what made every field balloon to fill
                              // its row instead of staying a compact 132px.
                              className="!w-[132px] !px-2.5 !py-1.5 !text-[13px]"
                            />
                            <span className="font-sans text-xs text-tn-muted-6">-</span>
                            <TimePicker
                              label={`${DAY_LABELS[dayOfWeek]} range ${index + 1} end`}
                              value={range.endTime}
                              onChange={(next) => updateRange(dayOfWeek, index, "endTime", next)}
                              className="!w-[132px] !px-2.5 !py-1.5 !text-[13px]" // see the start TimePicker's comment above
                            />
                            {index === ranges.length - 1 && (
                              <button
                                type="button"
                                onClick={() => addRange(dayOfWeek)}
                                title="Add another range"
                                aria-label={`Add another time range to ${DAY_LABELS[dayOfWeek]}`}
                                className="cursor-pointer rounded-md border-none bg-transparent px-1 font-sans text-base leading-none text-tn-muted-5 hover:text-tn-ink"
                              >
                                +
                              </button>
                            )}
                            {ranges.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeRange(dayOfWeek, index)}
                                title="Remove this range"
                                aria-label={`Remove time range ${index + 1} from ${DAY_LABELS[dayOfWeek]}`}
                                className="cursor-pointer rounded-md border-none bg-transparent px-1 font-sans text-base leading-none text-tn-muted-5 hover:text-tn-danger"
                              >
                                ×
                              </button>
                            )}
                            {index === 0 && (
                              <CopyTimesPopover
                                sourceDay={dayOfWeek}
                                dayLabels={DAY_LABELS}
                                displayOrder={DISPLAY_ORDER}
                                onApply={(targetDays) => copyTimesTo(dayOfWeek, targetDays)}
                              />
                            )}
                          </div>
                          {conflicts && (
                            <span className="font-sans text-xs text-tn-danger">
                              Overlapping or consecutive slots aren&rsquo;t permitted
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <span className="pt-1 font-sans text-[13px] text-tn-faint-2">Unavailable</span>
                )}
              </div>
            );
          })}
        </section>

        <section className="flex h-fit flex-col gap-3 rounded-2xl border border-tn-border p-5">
          <p className="m-0 font-sans text-sm font-semibold text-tn-ink">
            Date-specific availability
          </p>
          <p className="m-0 font-sans text-xs leading-relaxed text-tn-muted-5">
            Select specific dates when available hours differ from the regular schedule, or mark a
            date fully unavailable.
          </p>

          {overrides.length > 0 && (
            <div className="flex flex-col gap-2">
              {overrides.map((override) => (
                <div
                  key={override.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-tn-border-soft px-3.5 py-2.5"
                >
                  <div className="flex flex-col">
                    <span className="font-sans text-[13px] font-medium text-tn-ink">
                      {formatOverrideDate(override.date)}
                    </span>
                    <span className="font-sans text-xs text-tn-muted-5">
                      {override.isUnavailable
                        ? "Unavailable"
                        : `${override.startTime} - ${override.endTime}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOverrideToDelete(override)}
                    aria-label={`Remove override for ${override.date}`}
                    className="cursor-pointer rounded-md border-none bg-transparent px-1 font-sans text-base leading-none text-tn-muted-5 hover:text-tn-danger"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <Button
            variant="secondary"
            size="sm"
            className="w-fit"
            onClick={() => setOverrideModalOpen(true)}
          >
            + Add a date override
          </Button>
        </section>
      </div>

      <div className="flex items-center justify-end gap-3">
        {saveError && <p className="m-0 font-sans text-sm text-tn-danger">{saveError}</p>}
        {!saveError && hasConflicts && (
          <p className="m-0 font-sans text-sm text-tn-danger">
            Fix the overlapping or consecutive slots above before saving.
          </p>
        )}
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || hasConflicts}
        >
          {saveMutation.isPending ? "Saving…" : "Save Changes"}
        </Button>
      </div>

      <AddOverrideModal
        open={overrideModalOpen}
        onClose={() => setOverrideModalOpen(false)}
        onSubmit={(input) => addOverrideMutation.mutate(input)}
        submitting={addOverrideMutation.isPending}
      />

      <ConfirmModal
        open={overrideToDelete !== null}
        onClose={() => setOverrideToDelete(null)}
        onConfirm={() => overrideToDelete && removeOverrideMutation.mutate(overrideToDelete.id)}
        title="Remove this date override?"
        body={
          overrideToDelete
            ? `${formatOverrideDate(overrideToDelete.date)} will go back to the regular weekly schedule.`
            : undefined
        }
        confirmLabel="Remove"
        confirming={removeOverrideMutation.isPending}
      />

      {toast && <SuccessToast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

export default StaffAvailabilityEditor;
