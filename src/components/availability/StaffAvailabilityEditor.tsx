import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/auth/auth-store";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { AddOverrideModal } from "@/components/availability/AddOverrideModal";
import { SuccessToast } from "@/components/ui/Toast";
import { CopyTimesPopover } from "@/components/ui/CopyTimesPopover";
import { Collapsible } from "@/components/ui/Collapsible";
import { TimePicker } from "@/components/ui/TimePicker";
import {
  convertRange,
  friendlyZoneLabel,
  rangesOverlap,
  to12Hour,
  todayIsoIn,
  utcOffsetLabel,
  wallClockAt,
  zoneAbbreviation,
} from "@/lib/timezones";
import { CollisionPanel } from "@/components/availability/CollisionPanel";
import { AvailabilityActionBar } from "@/components/availability/AvailabilityActionBar";
import { DayClashPanel, hoursAndMinutes } from "@/components/availability/DayClashPanel";
import {
  editableDayOfWeek,
  otherSideOf,
  sideAt,
  useLiveCollisions,
  useRetained,
} from "@/components/availability/use-live-collisions";
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
 * Whether the "Cross-shop view" panel under the Save row is rendered.
 *
 * Off for now at the owner's request — flip to `true` to bring it back.
 * A flag rather than deleted code because the panel is finished work and
 * is expected to return; everything behind it (crossShopLines and the
 * conversions it runs) is deliberately left computing, since the same
 * lines also drive the "Not at this shop — <shop>" label on an empty day
 * in the grid. That label is a separate feature and stays on.
 */
const SHOW_CROSS_SHOP_VIEW: boolean = false;

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
/**
 * Which ranges in a day are wrong — either against each other, or on
 * their own.
 *
 * The "on their own" half is the one that used to be missing. A range
 * whose end is at or before its start is refused by setAvailability
 * ("must start before it ends") but was flagged by nothing on screen,
 * because this only ever compared *pairs*: a single mistyped 18:00-09:00
 * Monday looked perfectly fine, Save stayed live, and the first anyone
 * heard of it was a 400 from the server.
 */
function computeRangeConflicts(ranges: EditableRange[]): boolean[] {
  return ranges.map(
    (range, i) =>
      toMinutes(range.startTime) >= toMinutes(range.endTime) ||
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

/** One clash as a person would count it: the rule, plus how many dates it lands on. */
export interface ClashGroup {
  /** The first occurrence — what the panel draws and the bar names. */
  collision: Collision;
  /** How many more dates in the next eight weeks carry the same clash. */
  repeats: number;
  /**
   * Which of the three situations this is:
   *
   * blocks — a clash with hours that are stored. Red; refuses this save.
   * needs-other-save — already fixed on another tab, but that tab hasn't
   *   been saved, so this save is still refused. Red, and the remedy is
   *   somewhere else.
   * unsaved-elsewhere — only exists because of another tab's unsaved
   *   hours. Amber; this save is fine, that one won't be.
   */
  mode: ClashMode;
}

export type ClashMode = "blocks" | "needs-other-save" | "unsaved-elsewhere";

/**
 * Collapses dated collisions into the rules behind them.
 *
 * The guard answers in dates, because dates are the only thing it can
 * honestly compare: it walks eight weeks and reports every occurrence.
 * A single "Saturday 9-6 at both shops" therefore comes back as eight
 * findings, and counting those is how a bar ends up saying "16 clashes
 * block saving" about one mistake on one row — a number that is both
 * true and useless, since fixing the rule clears all sixteen at once.
 *
 * So occurrences of the same rule — same two shops, same local hours on
 * both sides, same weekday, same size of overlap — become one entry with
 * a repeat count. The overlap size is deliberately part of that key: when
 * a clock change moves one shop and not the other, the overlap grows or
 * shrinks, and that week is a different fact needing its own line rather
 * than a repeat of the others.
 */
function groupClashes(
  list: Collision[],
  locationId: string | null,
  mode: ClashMode = "blocks",
): ClashGroup[] {
  const groups = new Map<string, ClashGroup>();
  for (const collision of list) {
    const here = sideAt(collision, locationId) ?? collision.sides[0];
    const weekday = here ? new Date(`${here.localDate}T00:00:00Z`).getUTCDay() : -1;
    const key = [
      weekday,
      collision.overlapMinutes,
      collision.gapMinutes,
      ...[...collision.sides]
        .sort((a, b) => (a.locationId < b.locationId ? -1 : 1))
        .map((side) => `${side.locationId}:${side.source}:${side.localStart}-${side.localEnd}`),
    ].join("|");

    const existing = groups.get(key);
    if (existing) existing.repeats += 1;
    else groups.set(key, { collision, repeats: 0, mode });
  }
  return [...groups.values()];
}

/**
 * Clashes filed under the day row that causes them, at the shop on
 * screen.
 *
 * A clash whose local side is a date override or a real booking has no
 * row here to sit under and simply doesn't appear in this map — the bar
 * still counts it, and the save is still refused, but there is nothing
 * in the weekly grid to point at.
 */
function groupByDay(groups: ClashGroup[], locationId: string | null): Map<number, ClashGroup[]> {
  const byDay = new Map<number, ClashGroup[]>();
  for (const group of groups) {
    const day = editableDayOfWeek(group.collision, locationId);
    if (day === null) continue;
    byDay.set(day, [...(byDay.get(day) ?? []), group]);
  }
  return byDay;
}

/**
 * The weekday name a clash falls on.
 *
 * Read off this shop's own side where there is one, because that is the
 * row the manager is looking at — a window that runs into the small
 * hours resolves to the next UTC day, and `collision.date` would name a
 * Tuesday for hours typed into Monday. For a clash between two *other*
 * shops there is no side here to read, so the first side's local date is
 * used: it is still a real shop's own calendar day rather than the
 * shared UTC one.
 */
function clashWeekday(collision: Collision, locationId: string | null): string {
  const here = sideAt(collision, locationId) ?? collision.sides[0];
  const iso = here?.localDate ?? collision.date;
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
}

/**
 * "Monday, 9h with Valencia" — the bar's first line after the count.
 *
 * A clash between two shops that are *both* somewhere else still refuses
 * this save (the guard judges the member, not the tab), and it has no
 * row here to hang a panel off. So it names both shops instead of one:
 * without that the bar would say "Monday, 9h with Valencia" on a tab
 * where Valencia isn't the other side of anything, and the only honest
 * reading would be that the screen is broken.
 */
function blockerSummary(collision: Collision, locationId: string | null): string {
  const day = clashWeekday(collision, locationId);
  const size = hoursAndMinutes(collision.overlapMinutes);
  const here = sideAt(collision, locationId);
  const there = otherSideOf(collision, locationId);
  if (!here) {
    const [a, b] = collision.sides;
    return `${day}, ${size} between ${a?.locationName ?? "one shop"} and ${b?.locationName ?? "another"} — not on this tab`;
  }
  return `${day}, ${size} with ${there?.locationName ?? "another shop"}`;
}

/** "save Valencia first — Monday is fixed there but not saved". The way out is a tab, not another fix. */
function needsOtherSaveSummary(collision: Collision, locationId: string | null): string {
  const there = otherSideOf(collision, locationId);
  return `save ${there?.locationName ?? "the other shop"} first — ${clashWeekday(collision, locationId)} is fixed there but not saved`;
}

/** "Chauburji has unsaved hours that clash with Monday here" — names the tab that will refuse, not this one. */
function unsavedClashSummary(collision: Collision, locationId: string | null): string {
  const there = otherSideOf(collision, locationId);
  return `${there?.locationName ?? "Another shop"} has unsaved hours that clash with ${clashWeekday(collision, locationId)} here`;
}

/** The amber second line: says it is tight, and says in the same breath that it won't stop the save. */
function warningSummary(collision: Collision, locationId: string | null): string {
  const there = otherSideOf(collision, locationId);
  const gap =
    collision.gapMinutes === 0 ? "no gap" : `only ${hoursAndMinutes(collision.gapMinutes)}`;
  return `${clashWeekday(collision, locationId)} leaves ${gap} to reach ${there?.locationName ?? "the other shop"} — a warning, not a blocker`;
}

/**
 * Scrolls `el` to about a third of the way down whatever is actually
 * scrolling, rather than calling scrollIntoView.
 *
 * scrollIntoView scrolls every ancestor that can scroll and aims for the
 * top or the centre of the window, which on this page puts the day row
 * either under the sticky action bar or off the top of the form. Walking
 * up to the nearest scrollable ancestor and setting scrollTop keeps the
 * row where a person would have put it: high enough to read, with the
 * panel and the bar both still on screen.
 */
function scrollWithin(el: HTMLElement) {
  let container: HTMLElement | null = el.parentElement;
  while (container) {
    const { overflowY } = getComputedStyle(container);
    const scrolls =
      (overflowY === "auto" || overflowY === "scroll") &&
      container.scrollHeight > container.clientHeight;
    if (scrolls) break;
    container = container.parentElement;
  }

  if (container) {
    const top = el.getBoundingClientRect().top - container.getBoundingClientRect().top;
    container.scrollTo({
      top: container.scrollTop + top - container.clientHeight / 3,
      behavior: "smooth",
    });
    return;
  }

  const doc = document.scrollingElement ?? document.documentElement;
  const top = el.getBoundingClientRect().top + doc.scrollTop - window.innerHeight / 3;
  doc.scrollTo({ top, behavior: "smooth" });
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

  /** Which day's clash panel is open. At most one at a time — two expanded panels is a list of problems, not a thing to fix. */
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  /** Set by Review; the effect below scrolls to that day's panel and focuses its first fix once the panel has actually rendered. */
  const [pendingReviewDay, setPendingReviewDay] = useState<number | null>(null);
  /** Set when Review sent the manager to another shop's tab — the panel there opens as soon as that tab's answer arrives. */
  const [reviewOnArrival, setReviewOnArrival] = useState(false);
  /**
   * Where "Review" is up to, so a second press moves to the next
   * unresolved clash rather than the same one. One cursor per kind:
   * walking the warnings shouldn't move your place in the blockers,
   * which are the ones somebody is actually working through.
   */
  const reviewCursor = useRef<Record<"blocker" | "warning", number>>({ blocker: 0, warning: 0 });
  const panelRefs = useRef(new Map<number, HTMLDivElement | null>());
  /** Which shop the retained clashes below belong to. */
  const retainedClashesFor = useRef<string | null>(null);
  /**
   * The week as it was immediately before the last fix was applied.
   *
   * A fix rewrites fields the manager didn't type into — sometimes at
   * the other shop — so it has to be reversible in one move. Kept in the
   * form only: nothing has been written at this point, and the undo
   * disappears the moment anything else is edited or saved.
   */
  const [undoFix, setUndoFix] = useState<{
    dayOfWeek: number;
    label: string;
    /** Only the shops the fix actually touched — see undoLastFix. */
    weeks: WeeklyByLocation;
  } | null>(null);
  /**
   * When the last save landed. The bar says "Saved" for a few seconds
   * from here and then goes away.
   *
   * A timestamp rather than a boolean plus a stray setTimeout: the
   * timer then belongs to an effect, which clears it when the editor
   * unmounts, instead of firing three seconds later into a component
   * that has gone.
   */
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const justSaved = savedAt !== null;

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

  /**
   * The week on screen in the API's shape — what the live check asks
   * about, and exactly what Save would send.
   */
  const activeDays: AvailabilityDay[] = useMemo(
    () =>
      Array.from({ length: 7 }, (_, dayOfWeek) => ({
        dayOfWeek,
        ranges: weekly[dayOfWeek] ?? [],
      })),
    [weekly],
  );

  /**
   * The guard's verdict on the week as it currently stands, asked while
   * it is being typed rather than after Save is pressed. Same resolver
   * the save runs — see use-live-collisions.ts on why it is asked of the
   * server rather than worked out here.
   */
  /**
   * The other tabs' unsaved weeks, sent with the check.
   *
   * Save writes one shop, so hours typed into two tabs can clash while
   * neither is stored. Without these the clash was reported from
   * whichever tab was open when it was typed and disappeared on the
   * other — the server was comparing against a Chauburji that still had
   * its old week. Sending them makes the answer describe what the
   * manager has actually got on screen, and the hook keeps them in their
   * own bucket so they never disable a Save the server would accept.
   */
  const pendingWeeks = useMemo(
    () =>
      dirtyLocationIds
        .filter((id) => id !== activeLocationId)
        .map((id) => ({
          locationId: id,
          days: Array.from({ length: 7 }, (_, dayOfWeek) => ({
            dayOfWeek,
            ranges: (weeklyByLocation[id] ?? EMPTY_WEEK)[dayOfWeek] ?? [],
          })),
        })),
    [dirtyLocationIds, activeLocationId, weeklyByLocation],
  );

  const live = useLiveCollisions({
    accessToken,
    staffUserId,
    locationId: activeLocationId,
    days: activeDays,
    pending: pendingWeeks,
    // A member who works at one shop has nothing to collide with, and
    // the backend's own guard returns empty for them without reading
    // anything. Most accounts are that account, so the check simply
    // never runs for them rather than firing on every keystroke to be
    // told nothing.
    enabled: schedules.length > 1,
  });

  /**
   * What the screen counts as "a clash" — one per rule, not one per date
   * the guard walked into. See groupClashes.
   */
  const blockerGroups = useMemo(() => {
    // A blocker the manager has already cut on another tab is still a
    // blocker — the server hasn't seen the cut — but saying "Monday
    // clashes with Valencia" to somebody looking at the trim they just
    // made there is useless. It gets its own wording and its own way
    // out: save that tab first.
    const fixed = new Set(live.resolvedElsewhere.map((c) => `${c.date}|${c.fromAt}|${c.toAt}`));
    return [
      ...groupClashes(
        live.blockers.filter((c) => !fixed.has(`${c.date}|${c.fromAt}|${c.toAt}`)),
        activeLocationId,
        "blocks",
      ),
      ...groupClashes(live.resolvedElsewhere, activeLocationId, "needs-other-save"),
    ];
  }, [live.blockers, live.resolvedElsewhere, activeLocationId]);
  /**
   * Clashes with hours that are only in another tab. Amber, never red:
   * saving *this* shop still works, because what they collide with isn't
   * stored yet.
   */
  const pendingGroups = useMemo(
    () => groupClashes(live.pending, activeLocationId, "unsaved-elsewhere"),
    [live.pending, activeLocationId],
  );
  const warningGroups = useMemo(
    () => [...pendingGroups, ...groupClashes(live.warnings, activeLocationId)],
    [pendingGroups, live.warnings, activeLocationId],
  );
  const blockersByDay = useMemo(
    () => groupByDay(blockerGroups, activeLocationId),
    [blockerGroups, activeLocationId],
  );
  const warningsByDay = useMemo(
    () => groupByDay(warningGroups, activeLocationId),
    [warningGroups, activeLocationId],
  );
  /**
   * How many blockers touch each shop, including shops whose tab isn't
   * open.
   *
   * The guard judges the member, not the tab: a Valencia↔Soho overlap
   * refuses a save made from Chauburji just as firmly, and the answer
   * carries it whichever tab asked. Counting it per shop is what lets
   * the tab strip say where the problem actually is, instead of leaving
   * a dead Save button on a tab with nothing wrong on it.
   */
  const blockersByLocation = useMemo(() => {
    const counts = new Map<string, number>();
    // Pending clashes count here too. They don't block the tab you're
    // on, but they are exactly what the tab they're *at* will refuse —
    // which is the thing a badge on that tab is for.
    for (const { collision } of [...blockerGroups, ...pendingGroups]) {
      for (const side of collision.sides) {
        counts.set(side.locationId, (counts.get(side.locationId) ?? 0) + 1);
      }
    }
    return counts;
  }, [blockerGroups, pendingGroups]);

  /** Blocked days in the order the grid draws them, which is the order Review steps through. */
  const blockerDays = useMemo(
    () => DISPLAY_ORDER.filter((day) => blockersByDay.has(day)),
    [blockersByDay],
  );
  const warningDays = useMemo(
    () => DISPLAY_ORDER.filter((day) => warningsByDay.has(day)),
    [warningsByDay],
  );
  /**
   * Days carrying a genuine travel warning — not a clash with another
   * tab's unsaved hours, which shares the amber but is a different
   * thing.
   *
   * This is what decides whether Save carries acceptTravelWarning, and
   * that flag means "the manager has seen this gap and is going ahead".
   * An unsaved clash isn't a gap and doesn't need waving through, so
   * counting it here would wave through a tight drive nobody had been
   * shown.
   */
  const travelWarningDays = useMemo(
    () =>
      DISPLAY_ORDER.filter((day) =>
        (warningsByDay.get(day) ?? []).some((group) => group.mode !== "unsaved-elsewhere"),
      ),
    [warningsByDay],
  );

  /** Held while the undo line closes, for the same reason the clash panels are. */
  const shownUndo = useRetained(undoFix ?? undefined);

  /**
   * The last clash seen on each day, kept after it is fixed.
   *
   * A ref rather than state: nothing re-renders because of it, it only
   * supplies the content for a panel that is already on its way out. A
   * day is forgotten when the shop changes, so a stale Wednesday from
   * another tab can't close over this one's.
   */
  const retainedClashes = useRef(new Map<number, ClashGroup>());
  if (retainedClashesFor.current !== activeLocationId) {
    retainedClashes.current = new Map();
    retainedClashesFor.current = activeLocationId;
  }
  for (const day of DISPLAY_ORDER) {
    const current = blockersByDay.get(day)?.[0] ?? warningsByDay.get(day)?.[0];
    if (current) retainedClashes.current.set(day, current);
  }

  /**
   * Which fields are actually part of an overlap, so the red border goes
   * on those two inputs and nowhere else. Matched on the hours as typed,
   * because that is what the side carries back.
   */
  const clashingRangeKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const { collision } of blockerGroups) {
      const day = editableDayOfWeek(collision, activeLocationId);
      const here = sideAt(collision, activeLocationId);
      if (day === null || !here) continue;
      (weekly[day] ?? []).forEach((range, index) => {
        if (range.startTime === here.localStart && range.endTime === here.localEnd) {
          keys.add(`${day}:${index}`);
        }
      });
    }
    return keys;
  }, [blockerGroups, activeLocationId, weekly]);

  // Whether the shop on screen has anything to write is now `changeCount`
  // below, which the action bar needs as a number anyway ("5 changes
  // ready to save") rather than as a yes/no.

  /**
   * Only this shop's conflicts gate this shop's Save.
   *
   * This used to consider every dirty tab, because Save wrote every
   * dirty tab. Now that it writes one, a bad Tuesday two tabs over is
   * that tab's problem — blocking Valencia because Chauburji has an
   * overlapping pair would refuse a save that is perfectly valid, and
   * name a day the manager isn't looking at.
   */
  const hasConflicts = useMemo(() => weekHasConflicts(weekly), [weekly]);

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
   * How many days on this tab differ from what was last saved — the
   * bar's "5 changes ready to save".
   *
   * Counted in days rather than in fields: a manager who moved Tuesday's
   * start and end has made one change to Tuesday, not two.
   */
  const changeCount = useMemo(() => {
    const saved = savedByLocation[activeLocationId ?? ""] ?? EMPTY_WEEK;
    let changed = 0;
    for (let day = 0; day < 7; day++) {
      const now = weekly[day] ?? [];
      const before = saved[day] ?? [];
      const same =
        now.length === before.length &&
        now.every(
          (range, i) =>
            range.startTime === before[i]!.startTime && range.endTime === before[i]!.endTime,
        );
      if (!same) changed++;
    }
    return changed;
  }, [weekly, savedByLocation, activeLocationId]);

  /**
   * What the bar reports as blocking, in the order the manager can do
   * something about it.
   *
   * Plainly computed rather than memoized: both of these close over
   * `review`/`reviewOnAnotherTab`, which are redeclared every render, so
   * a dependency array could only ever be a lie about them — and the
   * work here is picking the first item out of a list the memos above
   * already built.
   *
   * A same-day range conflict comes first: it is a mistake in the fields
   * themselves, the server would refuse it too, and while one exists the
   * cross-shop answer is being computed about a week that can't be saved
   * anyway. It is the one blocker with no panel to review — the remedy
   * is the red message already under the row.
   */
  const blocked = (() => {
    if (hasConflicts) {
      return {
        count: 1,
        summary: "overlapping or consecutive slots in this week",
      };
    }
    const first = blockerGroups[0];
    if (!first) return null;
    return {
      count: blockerGroups.length,
      summary:
        first.mode === "needs-other-save"
          ? needsOtherSaveSummary(first.collision, activeLocationId)
          : blockerSummary(first.collision, activeLocationId),
      // Nothing has been touched, so this clash was waiting before
      // anyone opened the screen — usually a clock change moving hours
      // that were fine when they were set. Worth saying, because "you
      // broke this" is the natural reading otherwise.
      preExisting: changeCount === 0,
      // Somewhere to go in either case: the day's own panel when the
      // clash is on this tab, and the tab it *is* on when it isn't.
      onReview:
        blockerDays.length > 0
          ? () => review("blocker", blockerDays)
          : live.blockers.some((collision) =>
                collision.sides.some(
                  (side) =>
                    side.locationId !== activeLocationId &&
                    editableSchedules.some((schedule) => schedule.location.id === side.locationId),
                ),
              )
            ? reviewOnAnotherTab
            : undefined,
    };
  })();

  /** Amber, and never coupled to Save. */
  const warning = (() => {
    const first = warningGroups[0];
    if (!first) return null;
    return {
      count: warningGroups.length,
      // A clash with another tab's unsaved hours leads, when there is
      // one: it is going to refuse a save, just not this one, and that
      // is more use to know than a tight drive.
      kind: first.mode === "unsaved-elsewhere" ? ("unsaved" as const) : ("travel" as const),
      summary:
        first.mode === "unsaved-elsewhere"
          ? unsavedClashSummary(first.collision, activeLocationId)
          : warningSummary(first.collision, activeLocationId),
      onReview: warningDays.length > 0 ? () => review("warning", warningDays) : undefined,
    };
  })();

  /**
   * Review — the one link between the bar and the panel.
   *
   * It moves the viewport and opens a panel. It never saves, never
   * discards and never edits: a manager who presses it and changes their
   * mind has lost nothing. With more than one clash it advances, so
   * pressing it repeatedly walks the week rather than re-showing the
   * first one.
   */
  function review(kind: "blocker" | "warning", days: number[]) {
    if (days.length === 0) return;
    const day = days[reviewCursor.current[kind] % days.length]!;
    reviewCursor.current[kind] += 1;
    setExpandedDay(day);
    setPendingReviewDay(day);
  }

  /**
   * Go to the tab that has to be saved before this one will go through.
   *
   * Not a fix — nothing is edited. The week there is already correct; it
   * just hasn't been written, and a mutual overlap can only be unwound
   * in one order: the side being cut has to land first.
   */
  function openTabToSave(collision: Collision) {
    const editableIds = new Set(editableSchedules.map((schedule) => schedule.location.id));
    const target = collision.sides.find(
      (side) => side.locationId !== activeLocationId && editableIds.has(side.locationId),
    );
    if (target) setActiveLocationId(target.locationId);
  }

  /**
   * The clash isn't on this tab — so go to the tab it is on.
   *
   * Only reachable when the blocker has no row here, which is the case
   * the bar can otherwise only report and not resolve: two other shops
   * of the member's colliding with each other. The check re-runs for the
   * shop we land on, and the effect below opens its panel as soon as the
   * answer names a day.
   */
  function reviewOnAnotherTab() {
    const editableIds = new Set(editableSchedules.map((schedule) => schedule.location.id));
    for (const { collision } of blockerGroups) {
      const target = collision.sides.find(
        (side) => side.locationId !== activeLocationId && editableIds.has(side.locationId),
      );
      if (!target) continue;
      setActiveLocationId(target.locationId);
      setReviewOnArrival(true);
      return;
    }
  }

  // Runs after the panel it names has rendered — scroll it clear of the
  // action bar, then put focus on the first fix, so somebody on a
  // keyboard lands on the thing to press rather than at the top of a
  // panel they then have to tab through.
  useEffect(() => {
    if (pendingReviewDay === null) return;
    const el = panelRefs.current.get(pendingReviewDay);
    setPendingReviewDay(null);
    if (!el) return;
    scrollWithin(el);
    // Focus after the panel has finished opening. Focusing a button
    // inside a still-collapsed (overflow:hidden, zero-height) box makes
    // the browser scroll it into view itself, which fights the smooth
    // scroll that has just started and lands the row somewhere neither
    // of them intended.
    const timer = setTimeout(
      () => el.querySelector<HTMLElement>('[data-clash-fix="first"]')?.focus(),
      220,
    );
    return () => clearTimeout(timer);
  }, [pendingReviewDay]);

  // A panel whose clash has been fixed (or that belongs to a tab nobody
  // is looking at any more) closes itself rather than lingering as an
  // empty red box.
  useEffect(() => {
    if (expandedDay === null) return;
    if (!blockersByDay.has(expandedDay) && !warningsByDay.has(expandedDay)) setExpandedDay(null);
  }, [expandedDay, blockersByDay, warningsByDay]);

  useEffect(() => {
    if (savedAt === null) return;
    const timer = setTimeout(() => setSavedAt(null), 3000);
    return () => clearTimeout(timer);
  }, [savedAt]);

  // Opens the panel on the tab Review just switched to, once the check
  // has answered for it. Gives up rather than waiting forever if that
  // answer turns out to have no row to point at either.
  useEffect(() => {
    if (!reviewOnArrival) return;
    if (blockerDays.length > 0) {
      setReviewOnArrival(false);
      review("blocker", blockerDays);
      return;
    }
    if (live.status === "ready") setReviewOnArrival(false);
  }, [reviewOnArrival, blockerDays, live.status]);

  // Review starts from the top of the week again whenever the set of
  // clashes changes — keyed on which days they are, not how many, since
  // fixing Monday while Tuesday is still broken leaves the count alone
  // and would otherwise walk the cursor off the end of the list.
  const blockerDaysKey = blockerDays.join();
  const warningDaysKey = warningDays.join();
  useEffect(() => {
    reviewCursor.current = { blocker: 0, warning: 0 };
  }, [activeLocationId, blockerDaysKey, warningDaysKey]);

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
      setUndoFix(null);
      setExpandedDay(null);
      setSavedAt(Date.now());
      // The stored side of the question just moved. Usually the
      // fingerprint changes anyway (a tab stops being dirty), but a save
      // that leaves the form looking identical still needs re-asking.
      live.refresh();
      // The sweep's findings for this member are computed from the hours
      // that just changed, so whatever it last said about them is now
      // guesswork until it runs again.
      queryClient.invalidateQueries({ queryKey: ["collisions"] });
      // The bar says "Saved" where the button was, which is where
      // somebody who just pressed it is looking. The toast stays for the
      // case the bar can't cover: a save made from a tab that then
      // scrolled away under a long week.
      setToast(savedShopName ? `${savedShopName} availability saved` : "Availability saved");
    },
    onError: (err) => {
      const collision = collisionRefusal(err);
      if (collision) {
        // Since the live check went in, this is no longer the way a
        // manager normally meets a clash — the bar and the day panel got
        // there first, while they were still typing. What is left is the
        // case the form could not have known about: somebody else
        // changed the other shop's hours, or took a booking, between the
        // last check and this save. So the panel stays, as the backstop,
        // and says that is what happened.
        setRefusal({ code: collision.code, collisions: collision.collisions });
        setSaveError(null);
        // Whatever the live check last said was judged against hours
        // that have since moved.
        live.refresh();
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
    // Any edit of their own ends the undo: it would otherwise sit there
    // offering to throw away work done after the fix as well as the fix.
    setUndoFix(null);
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
  function trimAgainst(keep: CollisionSide, trim: CollisionSide, collision?: Collision) {
    const keepFrom = new Date(keep.startAt).getTime();
    const keepTo = new Date(keep.endAt).getTime();
    const trimFrom = new Date(trim.startAt).getTime();
    const trimTo = new Date(trim.endAt).getTime();
    // A travel warning has to move by the buffer as well as clear the
    // window, or trimming would produce hours the guard refuses again.
    // Taken from the clash being fixed when there is one (the live
    // panel passes it), and otherwise from the refusal on screen — the
    // two callers are the same remedy reached from the two places a
    // clash can appear.
    const bufferMs =
      (collision?.requiredGapMinutes ?? refusal?.collisions[0]?.requiredGapMinutes ?? 0) * 60_000;

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

  /**
   * A fix chosen in a day panel.
   *
   * Applied to the form and nowhere else — nothing is written until Save
   * is pressed, which is what makes it safe to offer a button that edits
   * hours at a shop whose tab isn't even open. The week as it stood is
   * kept so the whole thing is one undo, and the panel closes because
   * the check that follows will re-open it if it was wrong.
   */
  function applyFix(keep: CollisionSide, trim: CollisionSide, collision: Collision) {
    const dayOfWeek = new Date(`${trim.localDate}T00:00:00Z`).getUTCDay();
    setUndoFix({
      dayOfWeek,
      label: `${keep.locationName} keeps ${DAY_LABELS[dayOfWeek]}`,
      // Just the shop being cut, not the whole map: putting the whole
      // map back would also undo anything the background refetch
      // re-seeded in the meantime, and drop a shop the member has been
      // added to since.
      weeks: { [trim.locationId]: weeklyByLocation[trim.locationId] ?? EMPTY_WEEK },
    });
    trimAgainst(keep, trim, collision);
    setExpandedDay(null);
  }

  /** Puts the week back exactly as it was before the last fix. One step, and only ever the last one. */
  function undoLastFix() {
    if (!undoFix) return;
    setWeeklyByLocation((prev) => ({ ...prev, ...undoFix.weeks }));
    setUndoFix(null);
  }

  // Overrides the manager can still act on: today's, and everything
  // after it. A date that has already gone by is a record of what
  // happened, not a setting — it can't be edited into anything and
  // removing it changes nothing — so listing it only grows the panel
  // week by week with rows nobody can use. "Today" is read on the shop's
  // own clock, matching the date the Add modal will let them pick, so a
  // tab in another timezone doesn't drop its current day early.
  const todayAtShop = todayIsoIn(activeZone);
  const overrides = (activeSchedule?.overrides ?? []).filter(
    (override) => override.date >= todayAtShop,
  );

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
    <div className="tn-content-in flex flex-col gap-6" data-tour="hours-editor">
      {/* Standing collisions, from the nightly sweep. Above the grid
          rather than below it: this is a thing that is wrong now, not a
          note about what was just typed. Hidden while a refusal is on
          screen, since two red panels about overlapping shifts read as
          one confusing message rather than two separate facts. */}
      {/* Hidden while the live check has a blocker of its own, as well
          as while a refusal is on screen: the sweep's findings and the
          bar are usually describing the same clash from two directions,
          and two red things saying one thing reads as two problems. */}
      {!refusal && live.blockers.length === 0 && findings.length > 0 && (
        <section className="rounded-2xl border border-tn-danger/40 bg-tn-danger-bg px-4 py-3.5">
          <p className="m-0 font-sans text-xs font-semibold text-tn-danger">
            {findings.length === 1
              ? "A collision is already booked into this schedule"
              : `${findings.length} collisions are already booked into this schedule`}
          </p>
          <p className="m-0 mt-1 font-sans text-xs leading-relaxed text-tn-muted-5">
            Found by the nightly check rather than by anything anyone did — a clock change moving
            hours that were fine when they were set, a shop's timezone corrected, or somebody added
            to a second shop.
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
          /**
           * Why the save was refused, in the one sentence that is
           * actually true.
           *
           * "Changed while you were editing" is right for the case this
           * panel now exists for — somebody else moved the other shop's
           * hours, or took a booking, between the last check and the
           * save. It is wrong, and quite confusing, when the other shop
           * simply has edits sitting unsaved in this very form, which is
           * the other way a refusal gets here.
           */
          note={(() => {
            const other = refusal.collisions[0]?.sides.find(
              (side) => side.locationId !== activeLocationId,
            );
            const name = other?.locationName ?? "Another shop";
            return other && dirtyLocationIds.includes(other.locationId)
              ? `${name}’s hours haven’t been saved yet`
              : `${name} changed while you were editing`;
          })()}
          onTrim={(keep, trim, collision) => trimAgainst(keep, trim, collision)}
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
                    {/* A clash refuses the save from whichever tab it is
                        made on, so a manager can otherwise be left on a
                        tab with a dead Save button and nothing on it
                        that looks wrong. The badge says which shop the
                        problem is actually at.

                        Never on the open tab: the clash is already on
                        screen there — a red panel under the day, a red
                        bar at the bottom, and two red fields — and a
                        badge saying it a fourth time isn't telling
                        anybody anything. A badge's job is to point
                        somewhere you aren't looking. */}
                    {!isActive && (blockersByLocation.get(schedule.location.id) ?? 0) > 0 && (
                      <span
                        aria-label="This shop is part of a clash that blocks saving"
                        title="This shop is part of a clash that blocks saving"
                        className="tn-pop-in ml-1.5 inline-block min-w-4 rounded-full bg-tn-danger-strong px-1 text-center align-middle font-sans text-[10px] leading-4 font-semibold text-tn-on-dark"
                      >
                        {blockersByLocation.get(schedule.location.id)}
                      </span>
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
              // At most one panel per row, and a blocker outranks a
              // warning: red is reserved for what stops the save, and a
              // row can only usefully be making one point at a time.
              const dayClash =
                blockersByDay.get(dayOfWeek)?.[0] ?? warningsByDay.get(dayOfWeek)?.[0];
              // Held after it has gone, so the panel closes still saying
              // what it said rather than emptying out mid-animation.
              const shownClash = dayClash ?? retainedClashes.current.get(dayOfWeek);
              // Anything that hangs off this row rather than sitting in
              // it. The row's own bottom rule moves down past it, so a
              // panel reads as belonging to the day above rather than to
              // the day below.
              const hasRowExtras = Boolean(shownClash) || shownUndo?.dayOfWeek === dayOfWeek;
              const rowRule = i < DISPLAY_ORDER.length - 1 ? "border-b border-tn-border-soft" : "";
              return (
                <Fragment key={dayOfWeek}>
                  <div
                    /* items-start so a day with two ranges grows downward
                       rather than re-centring its toggle against the middle
                       of the stack. Every child's *first* line is the same
                       ROW_LINE band, which is what keeps an off day the same
                       height as an on one. */
                    className={`flex items-start gap-3 py-3 ${hasRowExtras ? "" : rowRule}`}
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
                          // The two fields that are actually in the
                          // overlap, and nothing else on the page: a row
                          // that merely sits near the problem shouldn't
                          // change colour.
                          const inClash = clashingRangeKeys.has(`${dayOfWeek}:${index}`);
                          const fieldTone = inClash ? "!border-[1.5px] !border-tn-danger" : "";
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
                                  className={`!w-[132px] !px-2.5 !py-1.5 !text-[13px] ${fieldTone}`}
                                />
                                <span className="font-sans text-xs text-tn-muted-6">-</span>
                                <TimePicker
                                  label={`${DAY_LABELS[dayOfWeek]} range ${index + 1} end`}
                                  value={range.endTime}
                                  onChange={(next) =>
                                    updateRange(dayOfWeek, index, "endTime", next)
                                  }
                                  className={`!w-[132px] !px-2.5 !py-1.5 !text-[13px] ${fieldTone}`} // see the start TimePicker's comment above
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
                                  {toMinutes(range.startTime) >= toMinutes(range.endTime)
                                    ? "This range has to start before it ends"
                                    : "Overlapping or consecutive slots aren’t permitted"}
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

                  {hasRowExtras && (
                    <div className={rowRule}>
                      {/* Component B — the detail, as a sibling of the row it
                      is about rather than a layer over it or a banner
                      somewhere above. The bar counts; this explains. */}
                      {shownClash && activeLocationId && (
                        <DayClashPanel
                          ref={(el) => {
                            panelRefs.current.set(dayOfWeek, el);
                          }}
                          open={dayClash !== undefined}
                          collision={shownClash.collision}
                          activeLocationId={activeLocationId}
                          expanded={expandedDay === dayOfWeek}
                          onExpand={() => setExpandedDay(dayOfWeek)}
                          onCollapse={() => setExpandedDay(null)}
                          onFix={applyFix}
                          editableLocationIds={editableSchedules.map(
                            (schedule) => schedule.location.id,
                          )}
                          resolveHref={
                            locationId
                              ? `/settings/hours?staff=${staffUserId}&shop=${locationId}`
                              : undefined
                          }
                          repeats={shownClash.repeats}
                          mode={shownClash.mode}
                          onOpenOtherTab={() => openTabToSave(shownClash.collision)}
                        />
                      )}

                      {/* A fix rewrote fields nobody typed into — sometimes at
                      another shop — so the way back is offered on the row
                      it happened to, and only until the next edit. Closes
                      rather than disappearing, like everything else that
                      arrives on these rows. */}
                      {shownUndo?.dayOfWeek === dayOfWeek && (
                        <Collapsible
                          open={undoFix?.dayOfWeek === dayOfWeek}
                          className="flex items-center gap-2 pb-3 font-sans text-xs text-tn-muted-5"
                        >
                          <span>{shownUndo.label}</span>
                          <button
                            type="button"
                            onClick={undoLastFix}
                            className="cursor-pointer rounded-md border-none bg-transparent p-0 font-sans text-xs font-semibold text-tn-gold hover:underline"
                          >
                            Undo
                          </button>
                        </Collapsible>
                      )}
                    </div>
                  )}
                </Fragment>
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

      {/* Component A — the form's permanent status, and the only place
          Save lives now.

          It replaces a row of conditional red lines beside the button.
          Those could only ever say something *after* Save had been
          pressed and refused, and they said it at the bottom of a page
          whose problem was three rows up. The bar is always there once
          there is something to say, it always says whether Save will
          work, and it hands the explaining to the panel under the day at
          fault.

          Always mounted, opening and closing on `visible` — a bar that
          only existed while it had something to say could never close,
          it could only vanish and take the page's height with it. */}
      <AvailabilityActionBar
        visible={changeCount > 0 || blocked !== null || warning !== null || justSaved}
        changeCount={changeCount}
        blocked={blocked}
        warning={warning}
        status={live.status}
        error={saveError}
        otherTabsNote={
          // Suppressed while a blocker is already naming the tab to go
          // to: two lines about the same other tab, one of them vaguer,
          // is how a screen teaches people to skim.
          blocked === null && otherDirtyLocations.length > 0
            ? `${otherDirtyLocations.map((schedule) => schedule.location.name).join(", ")} ${
                otherDirtyLocations.length === 1 ? "has" : "have"
              } unsaved changes too — open ${
                otherDirtyLocations.length === 1 ? "that tab" : "each tab"
              } to save ${otherDirtyLocations.length === 1 ? "it" : "them"}.`
            : null
        }
        saving={saveMutation.isPending}
        justSaved={justSaved}
        /**
         * A travel warning already on the bar is one the manager has
         * been shown, so the save carries the accept flag and goes
         * through — "warnings never block" is only true if the button
         * actually works the first time it is pressed.
         *
         * That flag used to mean "you were refused once and pressed it
         * again", because a refusal was the only way anyone heard
         * about a tight gap. The telling now happens before the click,
         * in the bar and in the amber panel under the day, so the
         * second press it was standing in for has already happened.
         *
         * Only warnings that have a row on this tab, and only while
         * the check is current. A tight gap between two *other*
         * shops has no amber panel here and the bar's second line
         * is hidden on a phone, so nobody has necessarily seen it
         * — that one should still stop the first save and put the
         * panel up, exactly as it did before.
         */
        onSave={() => saveMutation.mutate(live.status === "ready" && travelWarningDays.length > 0)}
      />

      {/* The only place the shops are read against one another.
          
          Below the Save row, not above it: this never blocks a save (see
          this component's doc comment), and sitting between the grid and
          the button made it read as something to clear before pressing
          it. It is reference material for the week you just typed —
          often a long list on a full schedule — so it belongs after the
          action, not in front of it. */}
      {SHOW_CROSS_SHOP_VIEW && crossShopLines.length > 0 && (
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
        minDate={todayAtShop}
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
