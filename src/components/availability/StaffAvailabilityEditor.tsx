import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/auth/auth-store";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { AddOverrideModal } from "@/components/availability/AddOverrideModal";
import { SuccessToast } from "@/components/ui/Toast";
import { CopyTimesPopover } from "@/components/ui/CopyTimesPopover";
import { TimePicker } from "@/components/ui/TimePicker";
import {
  convertRange,
  friendlyZoneLabel,
  rangesOverlap,
  to12Hour,
  utcOffsetLabel,
  wallClockAt,
  zoneAbbreviation,
} from "@/lib/timezones";
import { CollisionPanel } from "@/components/availability/CollisionPanel";
import {
  collisionRefusal,
  listCollisions,
  type Collision,
  type CollisionCode,
  type CollisionSide,
} from "@/lib/collisions-api";
import {
  getStaffAvailability,
  setStaffAvailability,
  addStaffOverride,
  removeStaffOverride,
  type AvailabilityDay,
  type AvailabilityOverride,
  type LocationSchedule,
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
export const SHORT_DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * The height of one line of a day row.
 *
 * Every part of a row — the toggle, the day name, the time fields, and
 * the "Not at this shop" label — is centred in a band of exactly this
 * height, so a day that is switched off takes up the same vertical space
 * as one that is switched on. Without it the fields set the height of an
 * enabled row and a bare line of text set the height of a disabled one,
 * and the week came out visibly ragged: toggling a day nudged every row
 * beneath it. `min-h` rather than `h` so a taller field can still grow
 * the band rather than overflow it.
 */
const ROW_LINE = "min-h-8";
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
/** One week per shop, keyed by location id — the tab strip's backing store. */
type WeeklyByLocation = Record<string, WeeklyState>;

function emptyWeek(): WeeklyState {
  const week: WeeklyState = {};
  for (let d = 0; d < 7; d++) week[d] = [];
  return week;
}

/**
 * The "no hours anywhere" week, shared rather than rebuilt.
 *
 * Nothing edits a week in place — every update below returns a new
 * object — so one frozen instance is safe, and a stable identity is what
 * lets the memos here actually memoize: a fresh `emptyWeek()` on each
 * render made `weekly` a new object every time, which invalidated the
 * conflict and cross-shop calculations on every keystroke and cost the
 * component its React Compiler optimization outright.
 */
const EMPTY_WEEK: WeeklyState = Object.freeze(emptyWeek());

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
 *
 * Within one shop only. Two *shops'* hours touching or overlapping once
 * converted to a common clock is a different question with a different
 * answer — see the cross-shop note below, which reports it and never
 * blocks on it.
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

function weekHasConflicts(week: WeeklyState): boolean {
  for (let d = 0; d < 7; d++) {
    if (computeRangeConflicts(week[d] ?? []).some(Boolean)) return true;
  }
  return false;
}

/** Structural comparison, so "typed 10:00 back over 10:00" isn't a change worth saving. */
function sameWeek(a: WeeklyState, b: WeeklyState): boolean {
  for (let d = 0; d < 7; d++) {
    const left = a[d] ?? [];
    const right = b[d] ?? [];
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i++) {
      if (left[i]!.startTime !== right[i]!.startTime) return false;
      if (left[i]!.endTime !== right[i]!.endTime) return false;
    }
  }
  return true;
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

/** One line of the cross-shop note: what another shop has on this weekday, said in *this* shop's clock. */
interface CrossShopLine {
  dayOfWeek: number;
  shopName: string;
  /** As written at the other shop, in its own clock. */
  thereStart: string;
  thereEnd: string;
  /** The same hours read on this shop's clock. */
  hereStart: string;
  hereEnd: string;
  /** True when the converted hours actually collide with what's set here that day — the difference between "worth knowing" and "she can't be in both places". */
  clashes: boolean;
  /** The converted range lands on the day before/after — worth saying, or the times read as nonsense. */
  dayShift: number;
}

export interface StaffAvailabilityEditorProps {
  /** Whose schedule this is. The caller decides who that is (self, a filter pick, a location's roster). */
  staffUserId: string;
  /** Heading above the weekly grid. "Set your availability" reads wrong when an owner is editing somebody else's week. */
  heading?: string;
  /**
   * Pin the editor to one shop and hide the tab strip. A location's
   * Availability tab already answers "which shop" by being that shop's
   * tab — offering a second, contradicting tab strip inside it would be
   * two answers to one question. The timezone banner and the cross-shop
   * note stay either way: those are about the shop you're on, not about
   * choosing one.
   */
  locationId?: string;
  /**
   * Which tab to open on, when every shop is still selectable.
   *
   * Distinct from `locationId`, which *restricts* the editor to one
   * shop: this only chooses the starting tab. The collision panel on a
   * location's own Availability tab links here to resolve a clash, and
   * without this the editor opened on whichever shop sorted first — so
   * a manager sent from Johar town landed on Chauburji and had to work
   * out for themselves that they were looking at the wrong week.
   *
   * Ignored if the member doesn't work at that shop, which falls back to
   * the first tab the same way an unset value does.
   */
  initialLocationId?: string;
}

/**
 * One staff member's working hours, per shop.
 *
 * A schedule is wall-clock time in the shop's own timezone, so it can
 * only ever describe one shop. That used to be enforced the other way
 * round — one week per person, and the backend refused to put anyone on
 * two shops in different zones — which meant an owner opening a branch
 * abroad simply could not be on it. Now each shop gets a tab, its own
 * week, and its own date overrides, and the tabs carry their UTC offsets
 * so it is obvious that "10:00" means two different instants on two of
 * them.
 *
 * The amber note under the grid is the one place the shops are read
 * against each other: it converts what is set elsewhere into the shop
 * you're looking at, and says so when they collide. It never blocks a
 * save — an owner filling in a week has to be able to pass through a
 * half-finished state, and how a member gets between two shops is not
 * something this screen can know.
 *
 * Unsaved edits are kept per shop and saved together: Save writes every
 * tab that differs from what was fetched, so switching tabs mid-edit
 * can't silently drop a week. Dirty tabs carry a dot.
 *
 * Extracted from HoursSettingsPage so the same editor backs both places
 * a schedule can be reached from — Settings › Availability (pick anyone
 * in the account) and a location's Availability tab (pick anyone on that
 * shop's roster, pinned to that shop). Owns its own fetch/save:
 * switching `staffUserId` re-seeds from the newly fetched schedules and
 * discards unsaved edits, which is the behaviour you want when the thing
 * you changed is *who* you're looking at.
 */
export function StaffAvailabilityEditor({
  staffUserId,
  heading = "Set your availability",
  locationId,
  initialLocationId,
}: StaffAvailabilityEditorProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const [weeklyByLocation, setWeeklyByLocation] = useState<WeeklyByLocation>({});
  const [activeLocationId, setActiveLocationId] = useState<string | null>(
    locationId ?? initialLocationId ?? null,
  );
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideToDelete, setOverrideToDelete] = useState<AvailabilityOverride | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  /**
   * The guard's refusal, if the last save was refused. Held rather than
   * thrown away because the panel it feeds is the remedy as well as the
   * message: its trim buttons need the resolved windows to work out what
   * to cut.
   */
  const [refusal, setRefusal] = useState<{
    code: CollisionCode;
    collisions: Collision[];
  } | null>(null);

  const availabilityQuery = useQuery({
    queryKey: ["availability", staffUserId],
    queryFn: () => getStaffAvailability(accessToken ?? "", staffUserId),
    enabled: !!accessToken && !!staffUserId,
    staleTime: 30_000,
  });

  /**
   * What the nightly sweep last found for this member.
   *
   * Separate from the save-time guard on purpose: these are collisions
   * that exist right now with nobody having edited anything — a DST
   * change moved an untouched rule, or a location's zone was corrected —
   * so there was no request to refuse and nothing to attach the news to
   * except this banner. Failing quietly is deliberate; a schedule editor
   * that won't load because a warning endpoint is down is worse than one
   * that shows no warnings.
   */
  const findingsQuery = useQuery({
    queryKey: ["collisions", staffUserId],
    queryFn: () => listCollisions(accessToken ?? "", { staffUserId }),
    enabled: !!accessToken && !!staffUserId,
    staleTime: 60_000,
    retry: false,
  });
  const findings = findingsQuery.data?.findings ?? [];

  /**
   * Every shop this member works at. When the caller pinned one, the
   * others are still fetched (the cross-shop note needs them) but only
   * the pinned one is editable, so a manager on Valencia's tab can see
   * that Wednesday belongs to Soho without being handed Soho's editor.
   */
  // Memoized rather than read inline: it feeds three useMemos below, and
  // a fresh [] on every render would recompute the cross-shop conversions
  // (and re-seed the tab strip) on every keystroke.
  const schedules: LocationSchedule[] = useMemo(
    () => availabilityQuery.data?.schedules ?? [],
    [availabilityQuery.data],
  );
  const editableSchedules = useMemo(
    () => (locationId ? schedules.filter((s) => s.location.id === locationId) : schedules),
    [schedules, locationId],
  );

  /** What the server last told us, to compare edits against. */
  const savedByLocation = useMemo(() => {
    const map: WeeklyByLocation = {};
    for (const schedule of schedules) {
      map[schedule.location.id] = toWeeklyState(schedule.weeklySchedule);
    }
    return map;
  }, [schedules]);

  /**
   * The last server state we seeded the form from. Only used to tell an
   * untouched shop from an edited one when fresh data arrives.
   */
  const seededRef = useRef<WeeklyByLocation>({});

  /**
   * Re-seed from the server, but never over an edit in progress.
   *
   * React Query refetches this in the background — on window focus, and
   * after every save invalidates it — and the first version of this
   * effect assigned the whole response straight into state. That was
   * survivable when the form held one week: you'd lose the edit you were
   * looking at. With a week per shop it would silently discard work on
   * tabs you weren't looking at, which is the kind of loss nobody
   * notices until the schedule is wrong.
   *
   * So a shop is re-seeded only when what's on screen still matches what
   * was last seeded for it — i.e. nobody has touched that tab. An edited
   * tab keeps its edit and stays dotted until it's saved (at which point
   * the save's own invalidation brings back a response that matches it
   * anyway).
   */
  useEffect(() => {
    if (schedules.length === 0) return;
    setWeeklyByLocation((prev) => {
      const next: WeeklyByLocation = { ...prev };
      for (const [id, saved] of Object.entries(savedByLocation)) {
        const onScreen = prev[id];
        const lastSeeded = seededRef.current[id];
        const untouched = !onScreen || !lastSeeded || sameWeek(onScreen, lastSeeded);
        if (untouched) next[id] = saved;
      }
      // Shops the member has been taken off drop out entirely rather
      // than lingering as an unreachable dirty tab.
      for (const id of Object.keys(next)) {
        if (!(id in savedByLocation)) delete next[id];
      }
      return next;
    });
    seededRef.current = savedByLocation;
  }, [savedByLocation, schedules.length]);

  // Land on the pinned shop, or the first tab. Re-points if the roster
  // changes underneath the selection (a member taken off a shop).
  useEffect(() => {
    if (editableSchedules.length === 0) return;
    if (editableSchedules.some((s) => s.location.id === activeLocationId)) return;
    setActiveLocationId(editableSchedules[0]!.location.id);
  }, [editableSchedules, activeLocationId]);

  // Memoized so `activeZone` below has a stable identity: it's a
  // dependency of the cross-shop conversions, and a value re-derived
  // each render there invalidates them on every keystroke.
  const activeSchedule = useMemo(
    () => editableSchedules.find((s) => s.location.id === activeLocationId),
    [editableSchedules, activeLocationId],
  );
  const activeZone = activeSchedule?.location.timezone ?? null;
  const weekly = useMemo(
    () => (activeLocationId ? (weeklyByLocation[activeLocationId] ?? EMPTY_WEEK) : EMPTY_WEEK),
    [activeLocationId, weeklyByLocation],
  );

  // Per-day "does range i conflict with an earlier range that same day"
  // flags for the shop on screen — drives the inline "Overlapping or
  // consecutive slots aren't permitted" messages below, and gates Save so
  // a conflict never even reaches setAvailability's own server-side
  // version of this check (see availability.service.ts).
  const weeklyConflicts = useMemo(() => {
    const conflicts: Record<number, boolean[]> = {};
    for (let d = 0; d < 7; d++) conflicts[d] = computeRangeConflicts(weekly[d] ?? []);
    return conflicts;
  }, [weekly]);

  /**
   * Shops whose week differs from the fetched one.
   *
   * Only ever *reported* now, never submitted as a batch — Save writes
   * the shop on screen and nothing else (see saveMutation). This list
   * drives the dots on the tabs and the "two other shops still have
   * unsaved changes" line, so an edit left on a tab you walked away from
   * is visible rather than silent.
   */
  const dirtyLocationIds = useMemo(
    () =>
      editableSchedules
        .map((s) => s.location.id)
        .filter(
          (id) =>
            weeklyByLocation[id] &&
            !sameWeek(weeklyByLocation[id]!, savedByLocation[id] ?? EMPTY_WEEK),
        ),
    [editableSchedules, weeklyByLocation, savedByLocation],
  );

  /** Is the shop on screen the one Save would write, and does it have anything to write? */
  const activeIsDirty = activeLocationId !== null && dirtyLocationIds.includes(activeLocationId);

  /**
   * Only this shop's conflicts gate this shop's Save.
   *
   * This used to consider every dirty tab, because Save wrote every
   * dirty tab. Now that it writes one, a bad Tuesday two tabs over is
   * that tab's problem — blocking Valencia because Chauburji has an
   * overlapping pair would refuse a save that is perfectly valid, and
   * name a day the manager isn't looking at.
   */
  const hasConflicts = weekHasConflicts(weekly);

  /** Other tabs with work on them, so the line under Save can say so without pretending Save will handle them. */
  const otherDirtyLocations = useMemo(
    () =>
      editableSchedules.filter(
        (schedule) =>
          schedule.location.id !== activeLocationId &&
          dirtyLocationIds.includes(schedule.location.id),
      ),
    [editableSchedules, dirtyLocationIds, activeLocationId],
  );

  /**
   * What the *other* shops have on each weekday, read on this shop's
   * clock. Empty for a single-shop member, which is why nothing about
   * this shows up for most accounts.
   */
  const crossShopLines: CrossShopLine[] = useMemo(() => {
    if (!activeLocationId) return [];
    // Built straight in Monday-first order rather than collected and
    // sorted, so nothing here mutates an array it also returns.
    return DISPLAY_ORDER.flatMap((dayOfWeek) =>
      schedules
        .filter((schedule) => schedule.location.id !== activeLocationId)
        .flatMap((schedule) => {
          const day = schedule.weeklySchedule.find((d) => d.dayOfWeek === dayOfWeek);
          return (day?.ranges ?? []).map((range) => {
            const converted = convertRange(
              range,
              dayOfWeek,
              schedule.location.timezone,
              activeZone,
            );
            // A range landing on a different day is compared against that
            // day's hours here, which is the day it actually occupies.
            const landedDay = (dayOfWeek + converted.dayShift + 7) % 7;
            // Compared against what's *on screen* for this shop, not what
            // was saved — an owner clearing Wednesday here to make room
            // for Soho should watch the clash resolve as they type.
            const clashes = (weekly[landedDay] ?? []).some((mine) =>
              rangesOverlap(mine, { startTime: converted.startTime, endTime: converted.endTime }),
            );
            return {
              dayOfWeek,
              shopName: schedule.location.name,
              thereStart: range.startTime,
              thereEnd: range.endTime,
              hereStart: converted.startTime,
              hereEnd: converted.endTime,
              clashes,
              dayShift: converted.dayShift,
            };
          });
        }),
    );
  }, [schedules, activeLocationId, activeZone, weekly]);

  /** Which weekdays another shop has hours on — turns an empty day from "Unavailable" into "Not at this shop". */
  const elsewhereDays = useMemo(() => {
    const days = new Map<number, string[]>();
    for (const line of crossShopLines) {
      const landed = (line.dayOfWeek + line.dayShift + 7) % 7;
      days.set(landed, [...new Set([...(days.get(landed) ?? []), line.shopName])]);
    }
    return days;
  }, [crossShopLines]);

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
    /**
     * `acceptTravelWarning` is passed straight through to the API and
     * only ever set by the panel's "Save anyway". It reaches the travel
     * half of the guard alone — an overlap comes back refused however
     * many times it is sent.
     */
    /**
     * One shop per submission: the one whose tab is open.
     *
     * The first cut wrote every dirty tab on a single click, and that was
     * the wrong shape for a screen whose entire premise is that each shop
     * is its own schedule on its own clock. It made one button stand for
     * three different writes, any of which could be refused by the
     * collision guard — so a refusal naming Valencia would arrive after
     * Chauburji had already been written, and the manager had to work out
     * from a dot which halves had landed. Saving what is on screen means
     * the button means exactly what it says, a refusal is always about
     * the shop being looked at, and the other tabs keep their edits until
     * they are opened and saved in turn.
     */
    mutationFn: async (acceptTravelWarning: boolean) => {
      if (!activeLocationId) return null;
      const week = weeklyByLocation[activeLocationId] ?? EMPTY_WEEK;
      const days: AvailabilityDay[] = Array.from({ length: 7 }, (_, dayOfWeek) => ({
        dayOfWeek,
        ranges: week[dayOfWeek] ?? [],
      }));
      await setStaffAvailability(
        accessToken ?? "",
        staffUserId,
        activeLocationId,
        days,
        acceptTravelWarning,
      );
      return activeSchedule?.location.name ?? null;
    },
    onSuccess: (savedShopName) => {
      invalidateAvailabilityViews();
      setSaveError(null);
      setRefusal(null);
      // The sweep's findings for this member are computed from the hours
      // that just changed, so whatever it last said about them is now
      // guesswork until it runs again.
      queryClient.invalidateQueries({ queryKey: ["collisions"] });
      setToast(savedShopName ? `${savedShopName} availability saved` : "Availability saved");
    },
    onError: (err) => {
      const collision = collisionRefusal(err);
      if (collision) {
        // Not a save error in the usual sense — the request was
        // understood perfectly and refused on purpose, and the panel has
        // a remedy to offer. Showing both a red line and the panel would
        // say the same thing twice.
        setRefusal({ code: collision.code, collisions: collision.collisions });
        setSaveError(null);
        return;
      }
      setRefusal(null);
      setSaveError(err instanceof Error ? err.message : "Couldn't save — try again.");
    },
  });

  const addOverrideMutation = useMutation({
    mutationFn: (input: UpsertOverrideInput) =>
      addStaffOverride(accessToken ?? "", staffUserId, activeLocationId ?? undefined, input),
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

  /** Every edit below goes through here, so the per-shop store is the only place a week is kept. */
  function updateActiveWeek(next: (prev: WeeklyState) => WeeklyState) {
    if (!activeLocationId) return;
    setWeeklyByLocation((prev) => ({
      ...prev,
      [activeLocationId]: next(prev[activeLocationId] ?? EMPTY_WEEK),
    }));
  }

  function toggleDay(dayOfWeek: number) {
    updateActiveWeek((prev) => {
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
    updateActiveWeek((prev) => ({
      ...prev,
      [dayOfWeek]: (prev[dayOfWeek] ?? []).map((r, i) =>
        i === index ? { ...r, [field]: value } : r,
      ),
    }));
  }

  function addRange(dayOfWeek: number) {
    updateActiveWeek((prev) => {
      const ranges = prev[dayOfWeek] ?? [];
      const last = ranges[ranges.length - 1];
      return {
        ...prev,
        [dayOfWeek]: [...ranges, { startTime: last?.endTime ?? "09:00", endTime: "18:00" }],
      };
    });
  }

  function removeRange(dayOfWeek: number, index: number) {
    updateActiveWeek((prev) => ({
      ...prev,
      [dayOfWeek]: (prev[dayOfWeek] ?? []).filter((_, i) => i !== index),
    }));
  }

  /**
   * Copies one day's ranges onto the days picked in CopyTimesPopover —
   * client-side, within this shop only, until Save Changes is pressed.
   * Copying across shops is deliberately not offered: the same "10:00"
   * is a different hour at each, so a copy button would be a fast way to
   * write a week nobody meant.
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
    updateActiveWeek((prev) => {
      const ranges = prev[sourceDay] ?? [];
      const next = { ...prev };
      for (const day of targetDays) {
        if (day === sourceDay) continue;
        next[day] = ranges.map((r) => ({ ...r }));
      }
      return next;
    });
  }

  /**
   * Cuts one side of a collision back until it clears the other.
   *
   * The arithmetic happens on the UTC timeline, because that is the only
   * frame in which the two shops' windows can be subtracted from each
   * other at all, and the result is converted back into the trimmed
   * shop's own wall clock before it touches the form — the manager
   * carries on reading the field in the clock they typed it in.
   *
   * A window can have a remainder on either side of the one being kept —
   * an eight-hour Soho day wrapped around a six-hour Valencia one has
   * both a morning and an evening left over — so both are measured and
   * the longer survives. Cutting to whichever side the loop happened to
   * test first is what turns a full day into a thirty-minute stub. A
   * window swallowed whole has no remainder at all, so that day's range
   * is removed rather than collapsed to something zero-length the API
   * would reject anyway.
   *
   * Applied to the weekly rule, not to the single dated occurrence the
   * refusal happened to name — "Valencia can't have her Wednesday
   * afternoon" is a statement about Wednesdays, and trimming one calendar
   * date would leave the same refusal waiting next week.
   */
  function trimAgainst(keep: CollisionSide, trim: CollisionSide) {
    const keepFrom = new Date(keep.startAt).getTime();
    const keepTo = new Date(keep.endAt).getTime();
    const trimFrom = new Date(trim.startAt).getTime();
    const trimTo = new Date(trim.endAt).getTime();
    // A travel warning has to move by the buffer as well as clear the
    // window, or trimming would produce hours the guard refuses again.
    const bufferMs = (refusal?.collisions[0]?.requiredGapMinutes ?? 0) * 60_000;

    // The two candidate remainders, in milliseconds of surviving shift.
    const headEnd = keepFrom - bufferMs;
    const tailStart = keepTo + bufferMs;
    const head = headEnd > trimFrom ? headEnd - trimFrom : 0;
    const tail = trimTo > tailStart ? trimTo - tailStart : 0;

    let nextStart: string | null = trim.localStart;
    let nextEnd: string | null = trim.localEnd;

    if (head === 0 && tail === 0) {
      // Nothing survives on either side — the kept window covers this one.
      nextStart = null;
    } else if (head >= tail) {
      nextEnd = wallClockAt(new Date(headEnd), trim.timezone);
    } else {
      nextStart = wallClockAt(new Date(tailStart), trim.timezone);
    }

    const dayOfWeek = new Date(`${trim.localDate}T00:00:00Z`).getUTCDay();
    setWeeklyByLocation((prev) => {
      const week = prev[trim.locationId] ?? EMPTY_WEEK;
      const ranges = (week[dayOfWeek] ?? []).flatMap((range) => {
        const isTheOne = range.startTime === trim.localStart && range.endTime === trim.localEnd;
        if (!isTheOne) return [range];
        if (nextStart === null || nextEnd === null) return [];
        return [{ startTime: nextStart, endTime: nextEnd }];
      });
      return { ...prev, [trim.locationId]: { ...week, [dayOfWeek]: ranges } };
    });

    // Move the manager to the tab that just changed, so the edit isn't
    // made somewhere they can't see it.
    if (!locationId) setActiveLocationId(trim.locationId);
    setRefusal(null);
  }

  const overrides = activeSchedule?.overrides ?? [];

  if (availabilityQuery.isError) {
    return (
      <p className="m-0 font-sans text-sm text-tn-danger">
        Couldn&rsquo;t load this schedule — try again.
      </p>
    );
  }

  if (availabilityQuery.isPending) {
    return <p className="m-0 font-sans text-sm text-tn-muted-5">Loading availability…</p>;
  }

  if (editableSchedules.length === 0) {
    return (
      <p className="m-0 rounded-2xl border border-dashed border-tn-border px-4 py-6 text-center font-sans text-sm text-tn-muted-5">
        This member isn&rsquo;t assigned to a location yet, so there&rsquo;s nowhere to set hours.
        Add them to one in Staff Management first.
      </p>
    );
  }

  return (
    // tn-content-in replays whenever a caller's key changes the staff
    // member being edited — see LocationAvailabilityTab / HoursSettingsPage.
    <div className="tn-content-in flex flex-col gap-6">
      {/* Standing collisions, from the nightly sweep. Above the grid
          rather than below it: this is a thing that is wrong now, not a
          note about what was just typed. Hidden while a refusal is on
          screen, since two red panels about overlapping shifts read as
          one confusing message rather than two separate facts. */}
      {!refusal && findings.length > 0 && (
        <section className="rounded-2xl border border-tn-danger/40 bg-tn-danger-bg px-4 py-3.5">
          <p className="m-0 font-sans text-xs font-semibold text-tn-danger">
            {findings.length === 1
              ? "A collision is already booked into this schedule"
              : `${findings.length} collisions are already booked into this schedule`}
          </p>
          <p className="m-0 mt-1 font-sans text-xs leading-relaxed text-tn-muted-5">
            Found by the nightly check, with nobody having edited anything — usually a clock change
            moving hours that were fine when they were set.
          </p>
          <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
            {findings.slice(0, 4).map((finding) => (
              <li key={finding.id} className="font-sans text-xs text-tn-ink-soft">
                <span className="font-semibold">
                  {new Date(finding.occursAt).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  })}
                </span>{" "}
                — {finding.locationAName} and {finding.locationBName}
                {finding.kind === "overlap"
                  ? ` overlap by ${finding.minutes} min`
                  : ` are ${finding.minutes} min apart, and travel needs ${finding.requiredGapMinutes}`}
                .
              </li>
            ))}
          </ul>
          {findings.length > 4 && (
            <p className="m-0 mt-1.5 font-sans text-xs text-tn-muted-5">
              …and {findings.length - 4} more.
            </p>
          )}
          {/* A finding names two shops, and a location's tab can only
              edit one of them, so the fix usually isn't on this screen. */}
          {locationId && (
            <Link
              to={`/settings/hours?staff=${staffUserId}&shop=${locationId}`}
              className="mt-2.5 inline-block rounded-lg border border-tn-input-border bg-tn-surface px-3 py-1.5 font-sans text-[12px] font-semibold text-tn-ink no-underline hover:bg-tn-neutral-bg"
            >
              Open this member&rsquo;s shops in Settings › Availability
            </Link>
          )}
        </section>
      )}

      {refusal && (
        <CollisionPanel
          code={refusal.code}
          collisions={refusal.collisions}
          // Only the shops this editor is actually showing. Pinned to one
          // on a location's tab, all of them in Settings › Availability.
          editableLocationIds={editableSchedules.map((schedule) => schedule.location.id)}
          // Offered only when pinned: the other shop in the clash is on a
          // screen this one can't reach, and the member is carried across
          // so the settings page opens on them rather than on you.
          // Both the member *and* the shop: the settings editor draws a
          // tab per shop and would otherwise open on whichever sorted
          // first, which is rarely the one the clash was raised on.
          resolveHref={
            locationId ? `/settings/hours?staff=${staffUserId}&shop=${locationId}` : undefined
          }
          onTrim={(keep, trim) => trimAgainst(keep, trim)}
          onSaveAnyway={() => saveMutation.mutate(true)}
          saving={saveMutation.isPending}
          onDismiss={() => setRefusal(null)}
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <section className="flex flex-col rounded-2xl border border-tn-border">
          <div className="border-b border-tn-border-soft px-5 pt-5 pb-4">
            <p className="m-0 font-sans text-sm font-semibold text-tn-ink">{heading}</p>
            <p className="m-0 mt-1 font-sans text-xs text-tn-muted-5">
              {editableSchedules.length > 1
                ? "Set hours per shop. Each shop keeps its own clock."
                : "Hours are set per shop, in that shop's own clock."}
            </p>
          </div>

          {/* One tab per shop, each carrying its UTC offset — the offsets
              are the point: without them two tabs reading "10:00 AM" look
              like the same hour. Hidden when the caller pinned a shop, or
              when there's only one to pick. */}
          {editableSchedules.length > 1 && (
            <div className="flex flex-wrap gap-1 border-b border-tn-border-soft px-3">
              {editableSchedules.map((schedule) => {
                const isActive = schedule.location.id === activeLocationId;
                const isDirty = dirtyLocationIds.includes(schedule.location.id);
                return (
                  <button
                    key={schedule.location.id}
                    type="button"
                    onClick={() => setActiveLocationId(schedule.location.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={`relative cursor-pointer border-none bg-transparent px-3 py-3 font-sans text-[13px] transition-colors duration-150 ${
                      isActive
                        ? "font-semibold text-tn-ink"
                        : "font-medium text-tn-muted-5 hover:text-tn-ink-soft"
                    }`}
                  >
                    {schedule.location.name}
                    <span className="ml-1.5 font-normal text-tn-muted-6">
                      · {utcOffsetLabel(schedule.location.timezone)}
                    </span>
                    {/* Unsaved work on a tab you're not looking at, said
                        where you'd look for it. Save writes only the tab
                        in view, so a dot is a place still to go rather
                        than something the next click will pick up. */}
                    {isDirty && (
                      <span
                        aria-label="Unsaved changes — open this tab to save them"
                        title="Unsaved changes — open this tab to save them"
                        className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-tn-gold align-middle"
                      />
                    )}
                    {/* Own element rather than a border on the button, so it
                        can animate its width in from the left — matches
                        LocationDetailPanel's tab strip. */}
                    {isActive && (
                      <span
                        key={activeLocationId}
                        aria-hidden
                        className="tn-underline-in absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-tn-ink"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-col gap-1 px-5 pt-4 pb-5">
            {/* Which clock the fields below are in, said once, rather than
                left to be inferred from the tab's offset. */}
            <p className="m-0 mb-3 rounded-xl bg-tn-neutral-bg px-3.5 py-2.5 font-sans text-xs leading-relaxed text-tn-muted-5">
              All times below are{" "}
              <span className="font-semibold text-tn-ink-soft">{activeZone ?? "UTC"}</span>, the
              zone set on {activeSchedule?.location.name ?? "this location"}
              {activeZone ? "" : " (no zone set — bookings read in UTC)"}. Change it in Location ›
              Details.
            </p>

            {DISPLAY_ORDER.map((dayOfWeek, i) => {
              const ranges = weekly[dayOfWeek] ?? [];
              const isOn = ranges.length > 0;
              const elsewhere = elsewhereDays.get(dayOfWeek);
              return (
                <div
                  key={dayOfWeek}
                  /* items-start so a day with two ranges grows downward
                     rather than re-centring its toggle against the middle
                     of the stack. Every child's *first* line is the same
                     ROW_LINE band, which is what keeps an off day the same
                     height as an on one. */
                  className={`flex items-start gap-3 py-3 ${
                    i < DISPLAY_ORDER.length - 1 ? "border-b border-tn-border-soft" : ""
                  }`}
                >
                  <div className={`flex flex-none items-center ${ROW_LINE}`}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isOn}
                      aria-label={`Toggle ${DAY_LABELS[dayOfWeek]}`}
                      onClick={() => toggleDay(dayOfWeek)}
                      // Matches ui/Toggle.tsx — see the colour note there.
                      className={`relative h-[22px] w-9 flex-none cursor-pointer rounded-full border-none transition-colors ${
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
                  </div>
                  <span
                    className={`flex w-24 flex-none items-center font-sans text-[13px] font-medium text-tn-ink-soft ${ROW_LINE}`}
                  >
                    {DAY_LABELS[dayOfWeek]}
                  </span>

                  {isOn ? (
                    <div className="flex flex-1 flex-col gap-2">
                      {ranges.map((range, index) => {
                        const conflicts = weeklyConflicts[dayOfWeek]?.[index] ?? false;
                        return (
                          <div key={index} className="flex flex-col gap-1">
                            <div className={`flex items-center gap-1.5 ${ROW_LINE}`}>
                              <TimePicker
                                label={`${DAY_LABELS[dayOfWeek]} range ${index + 1} start`}
                                value={range.startTime}
                                onChange={(next) =>
                                  updateRange(dayOfWeek, index, "startTime", next)
                                }
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
                              {/* The shop's own abbreviation after the pair,
                                  so a row states its clock even when the tab
                                  strip has scrolled out of view. */}
                              {index === 0 && (
                                <span className="ml-1 font-sans text-[11px] text-tn-faint-2">
                                  {zoneAbbreviation(activeZone)}
                                </span>
                              )}
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
                    // "Unavailable" is wrong when the reason the day is
                    // empty here is that she's at another shop — that day
                    // isn't a gap in her week, it belongs to somewhere else.
                    <span
                      className={`flex flex-1 items-center font-sans text-[13px] text-tn-faint-2 ${ROW_LINE}`}
                    >
                      {elsewhere ? `Not at this shop — ${elsewhere.join(", ")}` : "Unavailable"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="flex h-fit flex-col gap-3 rounded-2xl border border-tn-border p-5">
          <p className="m-0 font-sans text-sm font-semibold text-tn-ink">
            Date-specific availability
          </p>
          <p className="m-0 font-sans text-xs leading-relaxed text-tn-muted-5">
            Dates when {activeSchedule?.location.name ?? "this shop"}&rsquo;s hours differ from the
            regular schedule, or when this member isn&rsquo;t here at all. Overrides belong to this
            shop — a day off everywhere is one per tab.
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
        {/* Says what Save will *not* do. The button writes the shop on
            screen, so an edit sitting on another tab needs its own trip
            there — and the dot on that tab is easy to miss if nothing
            names it. */}
        {!saveError && !hasConflicts && otherDirtyLocations.length > 0 && (
          <p className="m-0 font-sans text-xs text-tn-muted-5">
            {otherDirtyLocations.map((schedule) => schedule.location.name).join(", ")}{" "}
            {otherDirtyLocations.length === 1 ? "has" : "have"} unsaved changes too — open{" "}
            {otherDirtyLocations.length === 1 ? "that tab" : "each tab"} to save{" "}
            {otherDirtyLocations.length === 1 ? "it" : "them"}.
          </p>
        )}
        <Button
          onClick={() => saveMutation.mutate(false)}
          disabled={saveMutation.isPending || hasConflicts || !activeIsDirty}
        >
          {/* Not "Save Valencia": the active tab already names the shop
              directly above, and a long shop name stretched the button
              out of line with every other Save in the app. What the
              button will and won't write is said in words beside it
              instead — see the line above. */}
          {saveMutation.isPending ? "Saving…" : "Save Changes"}
        </Button>
      </div>

      {/* The only place the shops are read against one another.
          
          Below the Save row, not above it: this never blocks a save (see
          this component's doc comment), and sitting between the grid and
          the button made it read as something to clear before pressing
          it. It is reference material for the week you just typed —
          often a long list on a full schedule — so it belongs after the
          action, not in front of it. */}
      {crossShopLines.length > 0 && (
        <section className="rounded-2xl border border-dashed border-tn-gold-soft bg-tn-gold-bg-soft px-4 py-3.5">
          <p className="m-0 font-sans text-xs font-semibold text-tn-gold">Cross-shop view</p>
          <p className="m-0 mt-1 font-sans text-xs leading-relaxed text-tn-muted-5">
            What&rsquo;s set at this member&rsquo;s other shops, read on{" "}
            {friendlyZoneLabel(activeZone)} time.
          </p>
          <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
            {crossShopLines.map((line, i) => (
              <li key={i} className="font-sans text-xs leading-relaxed text-tn-ink-soft">
                <span className="font-semibold">{SHORT_DAY_LABELS[line.dayOfWeek]}</span>{" "}
                {line.thereStart}–{line.thereEnd} is set at{" "}
                <span className="font-semibold">{line.shopName}</span>. In{" "}
                {friendlyZoneLabel(activeZone)} time that is {to12Hour(line.hereStart)}–
                {to12Hour(line.hereEnd)}
                {line.dayShift !== 0 &&
                  ` (${line.dayShift > 0 ? "the next day" : "the day before"}, ${SHORT_DAY_LABELS[(line.dayOfWeek + line.dayShift + 7) % 7]})`}
                .{" "}
                {line.clashes ? (
                  <span className="font-semibold text-tn-danger">
                    That collides with the hours set here.
                  </span>
                ) : (
                  <span className="text-tn-muted-5">Nothing set here then.</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

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
            ? `${formatOverrideDate(overrideToDelete.date)} will go back to ${activeSchedule?.location.name ?? "this shop"}'s regular weekly schedule.`
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
