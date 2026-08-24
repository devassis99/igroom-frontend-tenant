import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/auth/auth-store";
import { usePermissions } from "@/auth/use-permissions";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { AddOverrideModal } from "@/components/availability/AddOverrideModal";
import { SuccessToast } from "@/components/ui/Toast";
import { LocationFilterPopover } from "@/components/ui/LocationFilterPopover";
import { StaffFilterPopover } from "@/components/ui/StaffFilterPopover";
import { TimezonePicker } from "@/components/ui/TimezonePicker";
import { TimePicker } from "@/components/ui/TimePicker";
import { listStaff } from "@/lib/staff-api";
import { listLocations } from "@/lib/locations-api";
import {
  getStaffAvailability,
  setStaffAvailability,
  addStaffOverride,
  removeStaffOverride,
  type AvailabilityDay,
  type AvailabilityOverride,
  type UpsertOverrideInput,
} from "@/lib/availability-api";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// The reference page lists Monday first and Sunday last — dayOfWeek
// values underneath still follow JS Date#getDay() (0 = Sunday, matching
// every other place this app stores a weekday), only the on-screen row
// order is reshuffled to match.
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

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

/**
 * Settings > Availability — replaces the old static Hours & Availability
 * page (hardcoded display-only hours + a fake "Booking window" form,
 * neither backed by a real API) with a real per-staff-member editor,
 * modeled on the reference Availability screenshot: a weekly schedule
 * with a day on/off toggle and one or more time ranges per day, plus a
 * "Date-specific availability" panel for one-off overrides (a holiday,
 * or different hours for a single date).
 *
 * Kept out of this pass (see the chat thread this was scoped from):
 * multiple named schedules/tabs and "Create new availability" — iGroom
 * still has exactly one schedule per staff member; a real timezone
 * *picker* — shown read-only instead, from the staff member's location;
 * and the reference's "Active on X events" / "Launch troubleshooter" /
 * "Learn more" controls, which don't correspond to any real iGroom
 * feature.
 */
export function HoursSettingsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const { has, staffUser, isLoading: permissionsLoading } = usePermissions();
  const canManage = has("staff.manage");

  const [selectedStaffUserId, setSelectedStaffUserId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("all");
  const [weekly, setWeekly] = useState<WeeklyState>(emptyWeek());
  // null until the seeding effect below runs at least once — rendered as
  // "Loading…" (same as the rest of the page) rather than guessing at a
  // default before we actually know the location/browser fallback.
  const [timezone, setTimezone] = useState<string | null>(null);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideToDelete, setOverrideToDelete] = useState<AvailabilityOverride | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Default the picker to "myself" the moment GET /accounts/me resolves —
  // everyone can always see their own schedule, so there's no reason to
  // make even a non-manager wait on the staff-list fetch below.
  useEffect(() => {
    if (!selectedStaffUserId && staffUser) setSelectedStaffUserId(staffUser.id);
  }, [selectedStaffUserId, staffUser]);

  // Only a manager ever sees or needs the staff/location pickers — a
  // Barber only has permission to see their own schedule anyway (see
  // availability.service.ts's assertAvailabilityAccess), so there's
  // nothing for these two queries to back for them.
  const staffQuery = useQuery({
    queryKey: ["staff"],
    queryFn: () => listStaff(accessToken ?? ""),
    enabled: !!accessToken && canManage,
  });
  // Unlike staffQuery below (only a manager ever sees/needs the staff
  // picker), this one isn't manager-gated: a self-viewing Barber still
  // needs it to resolve their own location's timezone for the read-only
  // label next to "Set your availability" (see the `timezone` memo).
  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: () => listLocations(accessToken ?? ""),
    enabled: !!accessToken,
  });

  const staffOptions = useMemo(() => {
    const all = staffQuery.data?.staff ?? [];
    return selectedLocationId === "all"
      ? all
      : all.filter((s) => s.locationId === selectedLocationId);
  }, [staffQuery.data, selectedLocationId]);

  const selectedStaffMember = staffOptions.find((s) => s.id === selectedStaffUserId);
  // staffOptions (and so selectedStaffMember) is only populated for a
  // manager — staffQuery above is manager-gated. A self-viewing
  // non-manager always has selectedStaffUserId === their own id, so fall
  // back to staffUser.locationId (already on hand from GET /accounts/me)
  // rather than leaving this permanently null for the common "Barber
  // checking their own hours" case.
  const viewingLocationId =
    selectedStaffMember?.locationId ?? (canManage ? null : staffUser?.locationId);
  const locationTimezone = viewingLocationId
    ? (locationsQuery.data?.locations.find((l) => l.id === viewingLocationId)?.timezone ?? null)
    : null;

  // Switching the location filter can drop the currently-selected staff
  // member out of the list (they work at a different location) — fall
  // back to the first name still on screen rather than leaving the
  // <select> pointed at a value with no matching <option>.
  useEffect(() => {
    const fallback = staffOptions[0];
    if (!fallback) return;
    if (!staffOptions.some((s) => s.id === selectedStaffUserId)) {
      setSelectedStaffUserId(fallback.id);
    }
  }, [staffOptions, selectedStaffUserId]);

  const availabilityQuery = useQuery({
    queryKey: ["availability", selectedStaffUserId],
    queryFn: () => getStaffAvailability(accessToken ?? "", selectedStaffUserId!),
    enabled: !!accessToken && !!selectedStaffUserId,
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

  const saveMutation = useMutation({
    mutationFn: () => {
      const days: AvailabilityDay[] = Array.from({ length: 7 }, (_, dayOfWeek) => ({
        dayOfWeek,
        ranges: weekly[dayOfWeek] ?? [],
      }));
      return setStaffAvailability(accessToken ?? "", selectedStaffUserId!, days, timezone);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availability", selectedStaffUserId] });
      queryClient.invalidateQueries({ queryKey: ["staff-performance"] });
      setSaveError(null);
      setToast("Availability saved");
    },
    onError: (err) => {
      setSaveError(err instanceof Error ? err.message : "Couldn't save — try again.");
    },
  });

  const addOverrideMutation = useMutation({
    mutationFn: (input: UpsertOverrideInput) =>
      addStaffOverride(accessToken ?? "", selectedStaffUserId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availability", selectedStaffUserId] });
      setOverrideModalOpen(false);
    },
  });

  const removeOverrideMutation = useMutation({
    mutationFn: (overrideId: string) =>
      removeStaffOverride(accessToken ?? "", selectedStaffUserId!, overrideId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availability", selectedStaffUserId] });
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

  /** The screenshot's small "duplicate" icon per day — copies this day's ranges onto every other day, client-side only until Save Changes is pressed. */
  function copyToAllDays(dayOfWeek: number) {
    const ranges = weekly[dayOfWeek] ?? [];
    setWeekly((prev) => {
      const next = { ...prev };
      for (let d = 0; d < 7; d++) {
        if (d !== dayOfWeek) next[d] = ranges.map((r) => ({ ...r }));
      }
      return next;
    });
  }

  const overrides = availabilityQuery.data?.overrides ?? [];

  if (permissionsLoading || !selectedStaffUserId) {
    return (
      <div className="flex flex-col gap-8">
        <h1 className="m-0 font-sans text-2xl font-semibold text-tn-ink">Availability</h1>
        <p className="m-0 font-sans text-sm text-tn-muted-5">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 font-sans text-2xl font-semibold text-tn-ink">Availability</h1>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2.5">
            <LocationFilterPopover
              locations={locationsQuery.data?.locations ?? []}
              value={selectedLocationId}
              onChange={setSelectedLocationId}
              label="Filter by location"
            />
            <StaffFilterPopover
              staff={staffOptions}
              value={selectedStaffUserId ?? ""}
              onChange={setSelectedStaffUserId}
              selfId={staffUser?.id}
              label="Filter by member"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <section className="flex flex-col gap-1 rounded-2xl border border-tn-border p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="m-0 font-sans text-sm font-semibold text-tn-ink">Set your availability</p>
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
                  className={`relative mt-0.5 h-[22px] w-9 flex-none cursor-pointer rounded-full border-none transition-colors ${
                    isOn ? "bg-tn-gold" : "bg-tn-border-softer"
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
                              <button
                                type="button"
                                onClick={() => copyToAllDays(dayOfWeek)}
                                title="Copy these hours to every other day"
                                aria-label={`Copy ${DAY_LABELS[dayOfWeek]}'s hours to every other day`}
                                className="cursor-pointer rounded-md border-none bg-transparent px-1 font-sans text-xs text-tn-muted-5 hover:text-tn-ink"
                              >
                                ⧉
                              </button>
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

export default HoursSettingsPage;
