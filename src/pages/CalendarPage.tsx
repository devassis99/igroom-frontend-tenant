import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { LocationFilterPopover } from "@/components/ui/LocationFilterPopover";
import { TimezonePicker } from "@/components/ui/TimezonePicker";
import { AppointmentModal } from "@/components/calendar/AppointmentModal";
import { AppointmentListView } from "@/components/calendar/AppointmentListView";
import { AddBookingModal } from "@/components/calendar/AddBookingModal";
import { StaffFilterBar } from "@/components/calendar/StaffFilterBar";
import { ManageStaffSetsModal } from "@/components/calendar/ManageStaffSetsModal";
import { useAuthStore } from "@/auth/auth-store";
import { usePermissions } from "@/auth/use-permissions";
import {
  listBookings,
  listStaff,
  listStaffSets,
  createStaffSet,
  updateStaffSet,
  deleteStaffSet,
  reorderStaffSets,
  setDefaultStaffSet,
  getStaffShifts,
  type Booking,
  type BookingsStaffMember,
  type StaffSet,
  type StaffSetUpdatePayload,
  type StaffShift,
} from "@/lib/bookings-api";
import { listLocations, type AccountLocation } from "@/lib/locations-api";
import { BOOKING_STATUS_BLOCK } from "@/lib/booking-status";
import { staffAvatarColor } from "@/lib/staff-avatar-color";
import {
  addDays,
  addMonths,
  endOfWeekExclusive,
  formatDayNavLabel,
  formatMonthNavLabel,
  formatTimeLabel,
  formatWeekColumnLabel,
  formatWeekNavLabel,
  formatUtcOffset,
  getDaySlots,
  getMonthGrid,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfWeek,
  zonedHourMinute,
} from "@/lib/calendar-dates";

type View = "day" | "week" | "month" | "list";
type BookingModalMode = "detail" | "reschedule" | "cancel";

// Stable empty-array fallbacks — a fresh `[]` literal on every render would make
// the useMemo hooks below think `staff`/`bookings` changed even when they didn't.
const EMPTY_STAFF: BookingsStaffMember[] = [];
const EMPTY_BOOKINGS: Booking[] = [];
const EMPTY_LOCATIONS: AccountLocation[] = [];
const EMPTY_STAFF_SETS: StaffSet[] = [];

/** Per-location so switching locations doesn't carry over a staff selection that doesn't even apply there. */
function staffSelectionStorageKey(locationId: string): string {
  return `tn-cal-staff-selection:${locationId}`;
}

/** "09:00" -> "9 AM", "13:30" -> "1:30 PM" — a plain string formatter (no Date object) since these are wall-clock values with no date of their own. */
function formatShiftClock(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  let h = Number(hStr);
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return mStr === "00" ? `${h} ${period}` : `${h}:${mStr} ${period}`;
}

/** Backs the Day view column header's shift-hours line. */
function formatShiftSummary(shift: StaffShift | undefined): string {
  if (!shift || shift.isOff || shift.ranges.length === 0) return "Not working today";
  return shift.ranges
    .map((r) => `${formatShiftClock(r.startTime)}–${formatShiftClock(r.endTime)}`)
    .join(", ");
}

// Fallback when neither the selected location nor an explicit override
// supplies one — same "last resort" tier as PhoneInput's DEFAULT_COUNTRY.
const BROWSER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * A location's `timezone` field isn't guaranteed to be a real IANA zone —
 * TimezonePicker itself only ever offers valid ids, but a location's own
 * value can still come from an older free-text field, a bad import, or
 * direct API/DB edits, and calendar-dates.ts's zonedTimeToUtc throws a
 * RangeError (not something try/catching a component render helps with)
 * the moment an invalid one reaches it. Checked once here, at the single
 * point everything else in this file reads `timezone` from, so every
 * downstream call (daySlots, formatTimeLabel, the appointment/add-booking
 * modals, etc.) is protected without needing its own guard.
 */
function isValidTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Matches the Day view rows' own `min-h-16` (Tailwind's 4rem, i.e. 64px at
// the default root font size) — the red current-time line's pixel math
// below has to agree with that same row height or it'll drift out of
// alignment with the actual hour gridlines.
const DAY_SLOT_HEIGHT_PX = 64;

// Day view's frozen time gutter — both the header corner and every row's
// time-label button pin to the scroll container's left edge at this width
// (see the `sticky left-0` cells below), so the "now" line's marginLeft has
// to keep agreeing with it too.
const DAY_GUTTER_WIDTH_PX = 74;

// Staff columns floor at 200px (narrowest a two-line "Name / Service" card
// avoids truncating) and stop stretching past 320px (wider than that and a
// short card looks stranded in the middle of its own column) — with 2-4
// staff there's room for every column to grow toward the ceiling, past that
// columns hold at the floor and the grid scrolls horizontally instead of
// squeezing every column unreadably thin.
const DAY_COLUMN_WIDTH = "minmax(200px, 320px)";

// The trailing "Invite staff" column — unlike the fixed-ceiling staff
// columns above, this one is a genuine `1fr` track so it soaks up
// whatever's left once every staff column has grown to its 320px cap
// (that's the whole point: a brand-new account with just the owner's
// column gets one wide, roomy invite prompt rather than a cramped
// 320px-wide one). Once staff columns fill the container this shrinks to
// its own 240px floor and sits past the horizontal scroll, same as any
// other column would.
const DAY_INVITE_COLUMN_WIDTH = "minmax(240px, 1fr)";

interface AddBookingRequest {
  defaultDate: Date;
  defaultStaffId?: string;
  defaultTime?: string;
}

/** Matches the mockup's T7 / T7-week / T7-month Calendar frames, plus the T7c/d/e appointment modal — now backed by real igroom-backend data instead of hardcoded arrays. */
export function CalendarPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { has: hasPermission } = usePermissions();
  const canManageStaff = hasPermission("staff.manage");
  const location = useLocation();

  const [view, setView] = useState<View>("day");
  const [cursorDate, setCursorDate] = useState(() => new Date());
  // Which way the grid below should animate in on its next render — "next"
  // slides in from the right, "prev" from the left (paging forward/back in
  // time, Google Calendar-style), "fade" is the neutral case (Today, a
  // Day/Week/Month switch, or clicking a month cell — none of those are a
  // "before/after" relationship). Set alongside whatever state change
  // triggers the render, then read once at render time below.
  const [navDirection, setNavDirection] = useState<"prev" | "next" | "fade">("fade");
  // Which of the account's locations the grid below is showing — lets an
  // owner with multiple locations (see locations-api.ts) switch between
  // them via the dropdown next to the business-name badge, instead of
  // always seeing only their own home location. Starts empty (falls back
  // to the caller's own location server-side, see bookings.service.ts's
  // resolveLocationId) until the effect below picks a default once
  // `locations` has loaded.
  const [selectedLocationId, setSelectedLocationId] = useState("");
  // null = "follow the selected location's own timezone" (or the
  // browser's, if the location has none set) — set once the picker below
  // is used explicitly, and then sticks even if the location changes,
  // same override-wins-over-default relationship as PhoneInput's country.
  const [timezoneOverride, setTimezoneOverride] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedBookingMode, setSelectedBookingMode] = useState<BookingModalMode>("detail");
  const [addRequest, setAddRequest] = useState<AddBookingRequest | null>(null);
  // Which Day view time rows are highlighted, keyed by each row's slot
  // (`slot.toISOString()`, the same key each row is already keyed on
  // below) — clicking a time label in the hour gutter toggles that whole
  // row (across every staff column, not just that one cell) in or out of
  // the selection, so multiple rows can be highlighted at once by
  // clicking several times. Reset below whenever the day/view changes so
  // a highlight doesn't appear to "carry over" onto an unrelated slot
  // after navigating away and back.
  const [selectedRowSlotKeys, setSelectedRowSlotKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // The Day view's staff filter (StaffFilterBar below). null = "no explicit
  // choice restored yet for this location" — effectiveStaffIds (below)
  // falls back to that location's default saved set, or every active staff
  // member when there isn't one. An explicit choice (including "everyone",
  // once it's been chosen at least once) persists to localStorage per
  // location so it survives a refresh — see staffSelectionStorageKey.
  const [selectedStaffIds, setSelectedStaffIdsState] = useState<string[] | null>(null);
  const [manageSetsOpen, setManageSetsOpen] = useState(false);

  /** Opens the appointment modal straight into a given mode — the List view's inline Reschedule/Cancel row actions skip the extra click through the detail screen that the Day/Week/Month grid's plain click still goes through. */
  function openBooking(booking: Booking, mode: BookingModalMode = "detail") {
    setSelectedBooking(booking);
    setSelectedBookingMode(mode);
  }

  /** Sets the staff filter AND persists it, so a manual pick sticks around past a refresh — same "explicit override wins and sticks" relationship as timezoneOverride above. */
  function applyStaffSelection(ids: string[]) {
    setSelectedStaffIdsState(ids);
    if (!selectedLocationId) return;
    try {
      localStorage.setItem(staffSelectionStorageKey(selectedLocationId), JSON.stringify(ids));
    } catch {
      // Private browsing / quota exceeded — the pick still applies this session, it just won't survive a refresh.
    }
  }

  const range = useMemo(() => {
    if (view === "day") {
      const start = startOfDay(cursorDate);
      return { start, end: addDays(start, 1) };
    }
    if (view === "week") {
      return { start: startOfWeek(cursorDate), end: endOfWeekExclusive(cursorDate) };
    }
    const weeks = getMonthGrid(cursorDate);
    // getMonthGrid always returns full 7-day weeks, so these indices are never actually out of bounds.
    const first = weeks[0]![0]!;
    const last = weeks[weeks.length - 1]![6]!;
    return { start: first, end: addDays(last, 1) };
  }, [view, cursorDate]);

  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: () => listLocations(accessToken ?? ""),
    enabled: !!accessToken,
  });
  const locations = locationsQuery.data?.locations ?? EMPTY_LOCATIONS;

  // Day/Week grid's wall-clock zone — an explicit pick from the picker
  // below wins outright, otherwise it follows the selected location's own
  // timezone (see locations-api.ts), falling back to the browser's when
  // that location has none configured (e.g. an older location row from
  // before the field existed).
  const selectedLocation = locations.find((l) => l.id === selectedLocationId);
  const rawTimezone = timezoneOverride ?? selectedLocation?.timezone ?? BROWSER_TIMEZONE;
  // A bad value (see isValidTimeZone above) falls all the way back to the
  // browser's own zone rather than crashing the whole page — better to
  // show the wrong-but-plausible zone than an error boundary.
  const timezone = isValidTimeZone(rawTimezone) ? rawTimezone : BROWSER_TIMEZONE;

  // Default to the account's primary location the moment the list loads —
  // same "default to primary, let them change it" pattern as
  // AddMemberWizard's own location field.
  useEffect(() => {
    if (selectedLocationId || locations.length === 0) return;
    setSelectedLocationId(locations.find((l) => l.isPrimary)?.id ?? locations[0]!.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the list itself changes
  }, [locations]);

  // Restore whatever staff selection was last saved for this location (see
  // applyStaffSelection) — falls back to null ("no explicit choice") when
  // there isn't one, letting effectiveStaffIds below apply the location's
  // default saved set instead.
  useEffect(() => {
    if (!selectedLocationId) return;
    try {
      const raw = localStorage.getItem(staffSelectionStorageKey(selectedLocationId));
      setSelectedStaffIdsState(raw ? (JSON.parse(raw) as string[]) : null);
    } catch {
      setSelectedStaffIdsState(null);
    }
  }, [selectedLocationId]);

  const staffQuery = useQuery({
    queryKey: ["bookings-staff", selectedLocationId],
    queryFn: () => listStaff(accessToken ?? "", selectedLocationId || undefined),
    // Waits for the location list: firing while selectedLocationId is still
    // "" fetches every location, then immediately refetches for the real
    // one — two round trips for one page open.
    enabled: !!accessToken && !locationsQuery.isPending,
    placeholderData: keepPreviousData,
  });
  const staff = staffQuery.data?.staff ?? EMPTY_STAFF;

  const bookingsQuery = useQuery({
    queryKey: ["bookings", selectedLocationId, range.start.toISOString(), range.end.toISOString()],
    queryFn: () =>
      listBookings(
        accessToken ?? "",
        { start: range.start.toISOString(), end: range.end.toISOString() },
        selectedLocationId || undefined,
      ),
    // The List view has its own paged query (AppointmentListView) instead
    // of this date-range one — no need to fetch both while it's active.
    enabled: !!accessToken && view !== "list" && !locationsQuery.isPending,
    // The previous range's bookings stay on screen (fading/sliding out
    // under the transition below) while the new range loads, instead of
    // the grid flashing empty for a beat on every date/view/location
    // change.
    placeholderData: keepPreviousData,
  });
  const bookings = bookingsQuery.data?.bookings ?? EMPTY_BOOKINGS;

  const queryClient = useQueryClient();

  const staffSetsQuery = useQuery({
    queryKey: ["bookings-staff-sets", selectedLocationId],
    queryFn: () => listStaffSets(accessToken ?? "", selectedLocationId || undefined),
    enabled: !!accessToken && !locationsQuery.isPending,
  });
  const staffSets = staffSetsQuery.data?.staffSets ?? EMPTY_STAFF_SETS;

  function invalidateStaffSets() {
    queryClient.invalidateQueries({ queryKey: ["bookings-staff-sets", selectedLocationId] });
  }

  const createStaffSetMutation = useMutation({
    mutationFn: (input: { name: string; staffUserIds: string[]; isShared: boolean }) =>
      createStaffSet(accessToken ?? "", input),
    onSuccess: invalidateStaffSets,
  });
  const updateStaffSetMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: StaffSetUpdatePayload }) =>
      updateStaffSet(accessToken ?? "", id, patch),
    onSuccess: invalidateStaffSets,
  });
  const deleteStaffSetMutation = useMutation({
    mutationFn: (id: string) => deleteStaffSet(accessToken ?? "", id),
    onSuccess: invalidateStaffSets,
  });
  const reorderStaffSetsMutation = useMutation({
    mutationFn: (ids: string[]) => reorderStaffSets(accessToken ?? "", ids),
    onSuccess: invalidateStaffSets,
  });
  const setDefaultStaffSetMutation = useMutation({
    mutationFn: ({ id, isDefault }: { id: string; isDefault: boolean }) =>
      setDefaultStaffSet(accessToken ?? "", id, isDefault),
    onSuccess: invalidateStaffSets,
  });

  // Browser-local Y/M/D of the visible day — same "day identity stays
  // local, only time-of-day labels follow the selected timezone" rule
  // daySlots/isSameDay already follow elsewhere in this file. Backs the
  // shift-hours lookup below, which is inherently a per-calendar-day
  // question ("is this person working *this* day"), not a per-instant one.
  const dayYMD = useMemo(() => {
    const y = cursorDate.getFullYear();
    const m = String(cursorDate.getMonth() + 1).padStart(2, "0");
    const d = String(cursorDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [cursorDate]);

  // Every active staff id, stringified as a stable query-key fragment —
  // `staff` itself is a fresh array each fetch, which would otherwise
  // retrigger this query even when the actual roster didn't change.
  const activeStaffIdsKey = useMemo(
    () =>
      staff
        .map((s) => s.id)
        .sort()
        .join(","),
    [staff],
  );

  const shiftsQuery = useQuery({
    queryKey: ["bookings-staff-shifts", selectedLocationId, dayYMD, activeStaffIdsKey],
    queryFn: () =>
      getStaffShifts(
        accessToken ?? "",
        dayYMD,
        staff.map((s) => s.id),
        selectedLocationId || undefined,
      ),
    enabled: !!accessToken && view === "day" && staff.length > 0,
    placeholderData: keepPreviousData,
  });
  const shiftsByStaffId = useMemo(() => {
    const map = new Map<string, StaffShift>();
    for (const shift of shiftsQuery.data?.shifts ?? []) map.set(shift.staffUserId, shift);
    return map;
  }, [shiftsQuery.data]);
  /**
   * Whether the grid's height can be trusted not to change again — shifts
   * now decide how many rows the Day view has (see daySlots), so scrolling
   * to "now" before they land would aim at an offset that moves the moment
   * rows are added above it.
   *
   * A disabled query (no staff, or not on Day view) reports isPending
   * forever with fetchStatus "idle", so that has to count as settled or
   * the scroll would never fire at all.
   */
  const shiftsSettled = !shiftsQuery.isPending || shiftsQuery.fetchStatus === "idle";

  // Today's booking count per staff id (cancelled ones don't count as "a
  // booking to plan around") — backs the picker's "N booked" line and its
  // "Has bookings" quick filter. `bookings` is already scoped to the
  // visible range, which for Day view is exactly this one day.
  const bookingCountByStaffId = useMemo(() => {
    const map = new Map<string, number>();
    for (const booking of bookings) {
      if (booking.status === "cancelled") continue;
      map.set(booking.staffUserId, (map.get(booking.staffUserId) ?? 0) + 1);
    }
    return map;
  }, [bookings]);

  /**
   * Who the Day view actually shows right now. An explicit pick (from the
   * picker, a saved-set chip, or one restored from localStorage) wins
   * outright; otherwise this location's default saved set applies; and
   * failing that, every active staff member shows — same three-tier
   * "override > configured default > fallback" shape as the timezone
   * resolution above.
   */
  const effectiveStaffIds = useMemo(() => {
    if (selectedStaffIds !== null) return new Set(selectedStaffIds);
    const defaultSet = staffSets.find((s) => s.isDefault);
    if (defaultSet) return new Set(defaultSet.staffUserIds);
    return new Set(staff.map((s) => s.id));
  }, [selectedStaffIds, staffSets, staff]);

  function goPrev() {
    setNavDirection("prev");
    setCursorDate((d) =>
      view === "day" ? addDays(d, -1) : view === "week" ? addDays(d, -7) : addMonths(d, -1),
    );
  }
  function goNext() {
    setNavDirection("next");
    setCursorDate((d) =>
      view === "day" ? addDays(d, 1) : view === "week" ? addDays(d, 7) : addMonths(d, 1),
    );
  }
  function goToday() {
    setNavDirection("fade");
    setCursorDate(new Date());
  }
  // AppShell's sidebar "Calendar" link stamps a fresh `resetToken` into
  // navigation state on every click (see its own comment) specifically so
  // this can tell "the user clicked Calendar again" apart from every other
  // reason this page re-renders — a click while already on /calendar is a
  // same-route navigation, so the component stays mounted and cursorDate
  // wouldn't otherwise reset just because the user meant "take me back to
  // now". Reusing goToday() here means this gets the exact same "jump to
  // today" + "let the scroll-to-now effect re-fire" behavior the header's
  // own Today button already has, instead of a second copy of that logic.
  const navResetToken = (location.state as { resetToken?: number } | null)?.resetToken;
  useEffect(() => {
    // Guarded on the token being present (not just any location.state
    // change) so a fresh page load — no state at all — doesn't call this
    // redundantly; harmless either way since cursorDate already starts on
    // today, but there's no reason to.
    if (navResetToken === undefined) return;
    goToday();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the token itself should retrigger this, not goToday's identity
  }, [navResetToken]);
  function handleViewChange(next: View) {
    setNavDirection("fade");
    setView(next);
  }
  function handleLocationChange(next: string) {
    setNavDirection("fade");
    setSelectedLocationId(next);
  }
  /** Animation string for the {animation: ...} inline style below — same "keyframes in index.css, applied inline" pattern as LoadingScreen.tsx's spinner. */
  const gridAnimation =
    navDirection === "prev"
      ? "tn-cal-slide-in-left 260ms cubic-bezier(0.22, 1, 0.36, 1)"
      : navDirection === "next"
        ? "tn-cal-slide-in-right 260ms cubic-bezier(0.22, 1, 0.36, 1)"
        : "tn-cal-fade-in 220ms cubic-bezier(0.22, 1, 0.36, 1)";

  const navLabel =
    view === "day"
      ? formatDayNavLabel(cursorDate)
      : view === "week"
        ? formatWeekNavLabel(cursorDate)
        : formatMonthNavLabel(cursorDate);

  /**
   * The grid spans business hours (9am–7pm) widened to fit two things: the
   * hours the people on screen actually work, and any booking that falls
   * outside all of it.
   *
   * The shift half is why a barber rostered midnight-to-midnight gets a
   * full 24 rows instead of the 9–7 window their schedule plainly
   * contradicts. 9am–7pm survives as a floor rather than a default, so a
   * short 10–2 shift still renders as a recognisable working day instead
   * of collapsing to four rows.
   *
   * The booking half is load-bearing and predates the shift half: an
   * appointment outside the window — including one placed through Add
   * Booking's "Book anyway" override — must still be visible here, or it
   * silently vanishes from Day view while showing up fine in Week and
   * Month, which have no hour restriction at all.
   *
   * Shift times are compared as written, in the grid's display timezone,
   * matching isSlotOutsideShift's greying below. Both are wrong by the
   * offset if someone views a shop through a different timezone than the
   * schedule was authored in; fixing that belongs in one place, with that
   * function.
   */
  const daySlots = useMemo(() => {
    let minHour = 9;
    let maxHour = 19;

    for (const shift of shiftsByStaffId.values()) {
      if (shift.isOff) continue;
      for (const range of shift.ranges) {
        const [startHour] = range.startTime.split(":").map(Number);
        const [endHour, endMinute] = range.endTime.split(":").map(Number);
        minHour = Math.min(minHour, startHour ?? 0);
        // A shift ending 23:45 needs the 23:00 row drawn, so round the end
        // hour up before clamping to the end of the day.
        const endHourCeil = (endMinute ?? 0) > 0 ? (endHour ?? 0) + 1 : (endHour ?? 0);
        maxHour = Math.max(maxHour, Math.min(endHourCeil, 24));
      }
    }

    for (const booking of bookings) {
      const start = new Date(booking.startAt);
      if (!isSameDay(start, cursorDate)) continue; // overlaps in from the prior day — not this day's row range
      const end = new Date(booking.endAt);
      const startZoned = zonedHourMinute(start, timezone);
      const endZoned = zonedHourMinute(end, timezone);
      minHour = Math.min(minHour, startZoned.hour);
      const endHourCeil = endZoned.minute > 0 ? endZoned.hour + 1 : endZoned.hour;
      maxHour = Math.max(maxHour, Math.min(endHourCeil, 24));
    }
    return getDaySlots(cursorDate, minHour, Math.max(maxHour, minHour + 1), 30, timezone);
  }, [cursorDate, bookings, timezone, shiftsByStaffId]);

  /**
   * Columns for the Day view. Bookings only ever come back from the API
   * for staff who exist (bookings.service inner-joins staff_users), but
   * the *active* roster (`staff`, from /bookings/staff) can still exclude
   * a staff member who was deactivated after the booking was made — the
   * booking would then have no column to render into and disappear from
   * Day view while Week/Month (which don't key off the roster at all)
   * kept showing it fine. So any staffUserId seen on today's bookings
   * gets a column too, even if it's fallen out of the active roster.
   *
   * On top of that, the staff filter bar (effectiveStaffIds) narrows the
   * *active* roster down to whoever's currently picked — but a ghost
   * column stays visible regardless of the picker, since it isn't
   * selectable there in the first place and hiding it would just make an
   * existing booking silently vanish.
   */
  const dayColumns = useMemo(() => {
    const known = new Map(staff.map((member) => [member.id, member]));
    const ghostIds = new Set<string>();
    for (const booking of bookings) {
      if (!known.has(booking.staffUserId)) {
        known.set(booking.staffUserId, {
          id: booking.staffUserId,
          name: booking.staffName,
          role: "",
        });
        ghostIds.add(booking.staffUserId);
      }
    }
    return Array.from(known.values()).filter(
      (member) => ghostIds.has(member.id) || effectiveStaffIds.has(member.id),
    );
  }, [staff, bookings, effectiveStaffIds]);

  // Shared by the header row and every hour row below so the two grids stay
  // pixel-for-pixel aligned — fixed-width columns (see DAY_COLUMN_WIDTH)
  // mean this can genuinely overflow the card's width once there are enough
  // staff, which is what turns on the outer container's horizontal scroll.
  // The trailing invite track only exists for someone who can actually
  // invite anyone — without staff.manage there's nothing to click, so no
  // point reserving the space.
  const dayGridColumns = `${DAY_GUTTER_WIDTH_PX}px repeat(${Math.max(dayColumns.length, 1)}, ${DAY_COLUMN_WIDTH})${canManageStaff ? ` ${DAY_INVITE_COLUMN_WIDTH}` : ""}`;

  /** [staffId__slotHHmm] -> booking, floored to the slot it starts in — lets a booking at 1:05 still land in the 1:00 row. */
  const dayBookingsBySlot = useMemo(() => {
    const map = new Map<string, Booking>();
    if (view !== "day") return map;
    for (const booking of bookings) {
      const start = new Date(booking.startAt);
      const { hour, minute } = zonedHourMinute(start, timezone);
      const minutesSinceMidnight = hour * 60 + minute;
      const flooredMinutes = Math.floor(minutesSinceMidnight / 30) * 30;
      const hh = String(Math.floor(flooredMinutes / 60)).padStart(2, "0");
      const mm = String(flooredMinutes % 60).padStart(2, "0");
      map.set(`${booking.staffUserId}__${hh}:${mm}`, booking);
    }
    return map;
  }, [bookings, view, timezone]);

  // Ticks every 30s while Day view is open so the red current-time line
  // below keeps drifting down through the grid without needing a manual
  // refresh — cheap enough (a plain re-render, no refetch) to just leave
  // running the whole time the view is active.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (view !== "day") return;
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, [view]);

  const dayScrollRef = useRef<HTMLDivElement>(null);

  // Horizontal-scroll bookkeeping for the staff columns — backs the
  // progress bar, the right-edge fade, the "N of M columns in view" label,
  // and the floating jump button below the grid. Read from the scroll
  // container directly (rather than derived from state) since scroll
  // position isn't something React otherwise tracks.
  const [dayScroll, setDayScroll] = useState({ scrollLeft: 0, scrollWidth: 0, clientWidth: 0 });

  function handleDayScroll() {
    const el = dayScrollRef.current;
    if (!el) return;
    setDayScroll({
      scrollLeft: el.scrollLeft,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    });
  }

  // Re-measure whenever the column count or the view itself changes — e.g.
  // narrowing the staff filter can turn a scrollable grid into one that
  // fits entirely, which should hide the scroll-polish UI below.
  useEffect(() => {
    handleDayScroll();
  }, [dayColumns.length, view]);

  const dayScrollableWidth = Math.max(0, dayScroll.scrollWidth - dayScroll.clientWidth);
  const dayHasOverflow = dayScrollableWidth > 1;
  const dayScrollProgress = dayHasOverflow ? dayScroll.scrollLeft / dayScrollableWidth : 0;
  // Rough count, not exact — actual column widths vary between the 200px
  // floor and 320px ceiling (see DAY_COLUMN_WIDTH), so this uses the floor
  // as a conservative "at least this many fit" estimate.
  const dayColumnsInView = Math.max(
    1,
    Math.min(dayColumns.length, Math.floor((dayScroll.clientWidth - DAY_GUTTER_WIDTH_PX) / 200)),
  );

  /** Scrolls one viewport-width "page" of staff columns left/right. */
  function jumpDayColumns(direction: 1 | -1) {
    const el = dayScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * (el.clientWidth - DAY_GUTTER_WIDTH_PX), behavior: "smooth" });
  }

  /**
   * Whether `hh:mm` on the visible day falls outside `staffId`'s shift —
   * backs the greyed-out cell treatment below. Returns false (don't grey
   * out) when there's no shift data yet, since that's "not loaded" or "a
   * ghost column with no roster entry", not "this person is off" — greying
   * out on missing data would misread as a real off-shift signal.
   */
  function isSlotOutsideShift(staffId: string, hh: string, mm: string): boolean {
    const shift = shiftsByStaffId.get(staffId);
    if (!shift) return false;
    if (shift.isOff) return true;
    const minutes = Number(hh) * 60 + Number(mm);
    const within = shift.ranges.some((r) => {
      const [startH, startM] = r.startTime.split(":").map(Number);
      const [endH, endM] = r.endTime.split(":").map(Number);
      const startMinutes = startH! * 60 + startM!;
      const endMinutes = endH! * 60 + endM!;
      return minutes >= startMinutes && minutes < endMinutes;
    });
    return !within;
  }

  /**
   * Pixel offset of "now" within the Day view's slot rows, or null when
   * `now` isn't actually on the visible day (per the existing
   * browser-local day-identity rule, same as daySlots/isSameDay above) or
   * falls outside the grid's visible hour range. Assumes every row is
   * exactly DAY_SLOT_HEIGHT_PX tall — true as long as row content doesn't
   * wrap onto a second line.
   */
  const nowLineOffsetPx = useMemo(() => {
    if (view !== "day" || daySlots.length === 0) return null;
    if (!isSameDay(cursorDate, now)) return null;
    const first = zonedHourMinute(daySlots[0]!, timezone);
    const nowZoned = zonedHourMinute(now, timezone);
    const minutesFromStart =
      nowZoned.hour * 60 + nowZoned.minute - (first.hour * 60 + first.minute);
    const totalMinutes = daySlots.length * 30;
    if (minutesFromStart < 0 || minutesFromStart > totalMinutes) return null;
    return (minutesFromStart / 30) * DAY_SLOT_HEIGHT_PX;
  }, [view, daySlots, cursorDate, now, timezone]);

  // Arms the scroll-to-now effect below once per Day-view entry/day
  // switch/timezone/location change — reset here, consumed (and flipped
  // back on) there, so that effect can tell "haven't landed on `now` yet
  // for this day" apart from "already landed, don't yank the user's
  // scroll position back out from under them" without re-running on every
  // `now` tick or staff refetch.
  // `selectedLocationId` earns its place here too: switching location
  // swaps the whole set of columns, so landing on `now` again is right,
  // and it covers the location defaulting in on first load (it starts as
  // "" and flips to the account's primary the moment the list resolves) —
  // the scroll below is gated on staffQuery, which only starts fetching
  // once that id exists, so this reset is what re-arms it afterwards.
  //
  // The grid below is deliberately no longer keyed on selectedLocationId,
  // so that flip no longer remounts the scroll container underneath this.
  const scrolledToNowRef = useRef(false);
  useEffect(() => {
    scrolledToNowRef.current = false;
  }, [view, cursorDate, timezone, selectedLocationId]);

  // Lands the current time roughly a third of the way down the visible
  // grid on entering Day view or switching days — same landing spot
  // Google Calendar's Day view opens to — rather than requiring a manual
  // scroll to find "now". Gated on `staffQuery.isPending` rather than
  // firing the instant the scroll container mounts: on a fresh page load
  // the container renders before staff/bookings resolve, so the grid's
  // rows (and therefore its real scrollHeight) aren't there yet — scrolling
  // then just gets silently clamped back to 0 by the browser, and since
  // this used to depend only on [view, cursorDate, timezone], nothing
  // re-triggered it once the real content actually arrived, leaving the
  // view stuck at the top. Re-checking on every `nowLineOffsetPx` change
  // (which ticks with `now`) is safe because scrolledToNowRef makes every
  // run after the first a no-op instead of repeatedly resetting scroll.
  // Also re-checks on `selectedLocationId` itself (not just via the reset
  // above) so a remount caused by the location defaulting in gets an
  // immediate retry instead of waiting for the next unrelated `now` tick.
  //
  // useLayoutEffect, not useEffect: a plain effect runs *after* the browser
  // has painted, so the grid is drawn at scrollTop 0 and then yanked down
  // to "now" a frame later — visible as a jump every time the page opens.
  // Running before paint means the first frame the user sees is already in
  // the right place.
  useLayoutEffect(() => {
    if (view !== "day" || scrolledToNowRef.current) return;
    if (staffQuery.isPending || !shiftsSettled) return;
    if (nowLineOffsetPx === null || !dayScrollRef.current) return;
    const container = dayScrollRef.current;
    container.scrollTop = Math.max(0, nowLineOffsetPx - container.clientHeight / 3);
    scrolledToNowRef.current = true;
  }, [view, staffQuery.isPending, shiftsSettled, nowLineOffsetPx, selectedLocationId]);

  // Clear the row highlight(s) on any day/view change — otherwise a row
  // selected on one day could visually "reappear" selected on another day
  // that happens to have a slot at the exact same wall-clock time.
  useEffect(() => {
    setSelectedRowSlotKeys(new Set());
  }, [view, cursorDate]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(cursorDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursorDate]);

  const bookingsByDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const booking of bookings) {
      const key = startOfDay(new Date(booking.startAt)).toDateString();
      const list = map.get(key) ?? [];
      list.push(booking);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startAt.localeCompare(b.startAt));
    }
    return map;
  }, [bookings]);

  const monthWeeks = useMemo(() => getMonthGrid(cursorDate), [cursorDate]);

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <h1 className="m-0 font-serif text-[26px] font-semibold text-tn-ink">Calendar</h1>
          {locations.length > 1 && (
            <LocationFilterPopover
              locations={locations}
              value={selectedLocationId}
              onChange={handleLocationChange}
              label="Filter by location"
              includeAllOption={false}
            />
          )}
          <TimezonePicker value={timezone} onChange={setTimezoneOverride} />
        </div>
        <div className="flex items-center gap-3.5">
          {view !== "list" && (
            <>
              <button
                type="button"
                onClick={goToday}
                className="cursor-pointer rounded-lg border border-tn-input-border px-2.5 py-1.5 font-sans text-xs font-semibold text-tn-ink-soft hover:bg-tn-page"
              >
                Today
              </button>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label="Previous"
                  className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-lg border border-tn-input-border text-tn-muted-4 hover:bg-tn-page"
                >
                  ‹
                </button>
                <span className="min-w-[110px] text-center font-sans text-[13px] font-semibold text-tn-ink-soft">
                  {navLabel}
                </span>
                <button
                  type="button"
                  onClick={goNext}
                  aria-label="Next"
                  className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-lg border border-tn-input-border text-tn-muted-4 hover:bg-tn-page"
                >
                  ›
                </button>
              </div>
            </>
          )}
          <SegmentedControl
            value={view}
            onChange={handleViewChange}
            options={[
              { value: "day", label: "Day" },
              { value: "week", label: "Week" },
              { value: "month", label: "Month" },
              { value: "list", label: "List" },
            ]}
          />
          <Button onClick={() => setAddRequest({ defaultDate: cursorDate })}>+ Add Booking</Button>
        </div>
      </div>

      {staffQuery.isError && (
        <p className="m-0 font-sans text-sm text-tn-danger">
          Couldn&rsquo;t load staff right now (
          {staffQuery.error instanceof Error ? staffQuery.error.message : "unknown error"}) —
          refresh to try again.
        </p>
      )}

      {view !== "list" && bookingsQuery.isError && (
        <p className="m-0 font-sans text-sm text-tn-danger">
          Couldn&rsquo;t load bookings right now (
          {bookingsQuery.error instanceof Error ? bookingsQuery.error.message : "unknown error"}) —
          refresh to try again.
        </p>
      )}

      {/*
        Keyed to remount (and so replay the entrance animation, and reset
        scroll) whenever the view or the day changes.

        selectedLocationId is deliberately NOT part of this. It starts as ""
        and flips to the account's primary location the moment the list
        lands, so including it meant every page open mounted the whole
        grid, threw it away, and replayed the animation on the replacement
        — read as the calendar rendering twice. Switching location no
        longer replays the animation, which is the better behaviour anyway;
        the scroll-to-now reset below still watches selectedLocationId, so
        a location switch still lands on the current time.
      */}
      <div key={`${view}-${cursorDate.toDateString()}`} style={{ animation: gridAnimation }}>
        {view === "day" && !staffQuery.isPending && staff.length === 0 && (
          /* Brand-new account — no staff has been added at this location at all yet, so the
             grid below has nothing to show and no one to assign a booking to. Replaces the
             whole card rather than rendering an empty grid with a message buried in its header. */
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-tn-input-border bg-tn-page px-8 py-16 text-center">
            <span className="font-sans text-[15px] font-semibold text-tn-ink">
              No staff at this location yet
            </span>
            <span className="max-w-[380px] font-sans text-[13px] text-tn-muted-5">
              Add your first staff member and their working hours — once they&rsquo;re on the
              roster, their column shows up here automatically.
            </span>
            <Link
              to="/staff"
              className="mt-1 cursor-pointer rounded-lg border-none bg-tn-dark px-4 py-2.5 font-sans text-[13px] font-semibold text-tn-on-dark no-underline"
            >
              Add staff
            </Link>
          </div>
        )}

        {view === "day" && (staffQuery.isPending || staff.length > 0) && (
          <div className="flex flex-col gap-3">
            <StaffFilterBar
              allStaff={staff}
              selectedStaffIds={Array.from(effectiveStaffIds)}
              onApply={applyStaffSelection}
              shiftsByStaffId={shiftsByStaffId}
              bookingCountByStaffId={bookingCountByStaffId}
              staffSets={staffSets}
              onApplySet={(set) => applyStaffSelection(set.staffUserIds.slice())}
              onCreateSet={(name, staffUserIds, isShared) =>
                createStaffSetMutation.mutate({ name, staffUserIds, isShared })
              }
              onOpenManageSets={() => setManageSetsOpen(true)}
              isSaving={createStaffSetMutation.isPending}
            />

            <div className="relative flex flex-col overflow-hidden rounded-2xl border border-tn-border">
              {/* Fixed-height, self-scrolling grid (independent of the page's own scroll container) so the
                  header row below can stay pinned while the hour rows scroll under it, and so the
                  auto-scroll-to-now effect has a predictable container to act on. Columns are fixed-width
                  (see DAY_COLUMN_WIDTH) rather than `1fr`, so a location with enough staff overflows this
                  container's own width too — `overflow-auto` (not just -y) is what turns that into a
                  horizontal scrollbar instead of squeezing every column unreadably thin. */}
              <div
                ref={dayScrollRef}
                onScroll={handleDayScroll}
                className="max-h-[640px] overflow-auto"
              >
                <div
                  className="sticky top-0 z-20 grid border-b border-tn-border-softer bg-tn-table-head"
                  style={{ gridTemplateColumns: dayGridColumns }}
                >
                  {/* The one cell that's sticky on BOTH axes — pinned to the top via the row above and to
                      the left here, so it stays put as the corner anchor while the rest of the header (and
                      every row's own gutter cell below) scrolls sideways underneath it. Needs its own
                      opaque background (matching the header row's) since sticky positioning takes it out of
                      the row's normal paint order. */}
                  <div className="sticky left-0 z-10 flex items-center justify-center bg-tn-table-head p-2 text-center font-sans text-[11px] font-medium text-tn-muted-5">
                    {formatUtcOffset(timezone)}
                  </div>
                  {staffQuery.isPending && (
                    <div className="border-l border-tn-border-soft p-3 font-sans text-[13px] text-tn-muted-5">
                      Loading staff…
                    </div>
                  )}
                  {!staffQuery.isPending && dayColumns.length === 0 && (
                    <div className="border-l border-tn-border-soft p-3 font-sans text-[13px] text-tn-muted-5">
                      No staff selected — use the Staff picker above to choose who to show.
                    </div>
                  )}
                  {dayColumns.map((member) => {
                    const shift = shiftsByStaffId.get(member.id);
                    const bookingCount = bookingCountByStaffId.get(member.id) ?? 0;
                    return (
                      <div
                        key={member.id}
                        className="flex min-w-0 items-center gap-2.5 border-l border-tn-border-soft p-3"
                      >
                        <span
                          className="h-8 w-8 shrink-0 rounded-full"
                          style={{ background: staffAvatarColor(member.id) }}
                        />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-sans text-[13px] font-semibold text-tn-ink">
                            {member.name}
                          </span>
                          <span className="truncate font-sans text-[10.5px] text-tn-muted-5">
                            {formatShiftSummary(shift)}
                            {bookingCount > 0 ? ` · ${bookingCount} booked` : ""}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                  {canManageStaff && (
                    <Link
                      to="/staff"
                      className="flex items-center gap-2 border-l border-dashed border-tn-input-border p-3 font-sans text-[13px] font-semibold text-tn-blue no-underline hover:bg-tn-page"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-tn-blue text-xs">
                        +
                      </span>
                      Add team member
                    </Link>
                  )}
                </div>

                <div className="relative">
                  {/* Google Calendar-style "now" line — a dot at the hour gutter's right edge plus a line
                      spanning the staff columns, positioned in px (see DAY_SLOT_HEIGHT_PX/nowLineOffsetPx)
                      rather than as a real grid row, so it can sit *between* two rows without disturbing
                      the booking grid's own layout. Wrapped in the same dayGridColumns grid the rows/header
                      use (rather than a plain `inset-x-0` + flex-1 fill, which used to stretch the line all
                      the way across the invite/"Add team member" track too) and spanned only through the
                      last real staff track, so — like the past-dulled row background and the invite overlay
                      itself — the line stops where the actual staff columns end. */}
                  {nowLineOffsetPx !== null && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-[5] grid"
                      style={{ top: nowLineOffsetPx, gridTemplateColumns: dayGridColumns }}
                    >
                      <div
                        className="flex items-center"
                        style={{
                          gridColumn: canManageStaff
                            ? `1 / ${Math.max(dayColumns.length, 1) + 2}`
                            : "1 / -1",
                          marginLeft: DAY_GUTTER_WIDTH_PX,
                        }}
                      >
                        <span className="h-2.5 w-2.5 shrink-0 -translate-x-1/2 rounded-full bg-tn-danger" />
                        <span className="h-px flex-1 bg-tn-danger" />
                      </div>
                    </div>
                  )}

                  {/* The invite prompt itself — an overlay using the exact same
                      dayGridColumns template as the header/rows rather than any
                      measured pixel math, so it lands in the invite track no
                      matter how wide the staff columns before it have grown.
                      Matches Day View Merged.dc.html's frame C, which centers
                      this card (both axes) within its column — but that mockup's
                      grid is only 5 rows tall, so plain centering lands the card
                      mid-page there. A real day can run to many more rows than
                      fit in the `max-h-[640px]` scroll container, so centering
                      within the *full* (scrollable) column would often push the
                      card below the fold.
                      Outer wrapper is `sticky top-0` with `h-0` — zero height so
                      it takes up no space in flow (an earlier version gave *this*
                      div the `h-[640px]`, which being `sticky` — still in-flow,
                      unlike `absolute` — pushed every hour row down by 640px of
                      blank space). The actual 640px band lives on the *inner*
                      grid instead, which overflows its zero-height sticky parent
                      without affecting any sibling's position — the same trick
                      the header row's stickiness relies on, just with the height
                      moved down a level. Centering the card inside that inner
                      band reproduces the mockup's centered look while it stays in
                      view instead of scrolling away with the hour rows beneath it. */}
                  {canManageStaff && (
                    <div className="pointer-events-none sticky top-0 z-[6] h-0">
                      <div
                        className="grid h-[640px]"
                        style={{ gridTemplateColumns: dayGridColumns }}
                      >
                        <div
                          className="pointer-events-auto flex flex-col items-center gap-2 self-center justify-self-center rounded-2xl border border-dashed border-tn-input-border bg-tn-page px-6 py-8 text-center"
                          // The `repeat(...)` count in dayGridColumns floors at 1 staff
                          // track even when dayColumns is empty (an all-deselected
                          // picker) — match that floor here too, or this would target
                          // one track short of where the invite column actually is.
                          style={{ gridColumn: Math.max(dayColumns.length, 1) + 2 }}
                        >
                          <span className="font-sans text-[14px] font-semibold text-tn-ink">
                            One column per team member
                          </span>
                          <span className="max-w-[260px] font-sans text-xs text-tn-muted-5">
                            Invite your barbers and each gets a 200px column here. Past five,
                            columns hold their width and the grid scrolls — the staff picker above
                            chooses who&rsquo;s in view.
                          </span>
                          <Link
                            to="/staff"
                            className="mt-1 cursor-pointer rounded-lg border-none bg-tn-dark px-4 py-2.5 font-sans text-[13px] font-semibold text-tn-on-dark no-underline"
                          >
                            Invite staff
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}

                  {daySlots.map((slot, rowIndex) => {
                    const slotZoned = zonedHourMinute(slot, timezone);
                    const hh = String(slotZoned.hour).padStart(2, "0");
                    const mm = String(slotZoned.minute).padStart(2, "0");
                    const slotKey = slot.toISOString();
                    const isRowSelected = selectedRowSlotKeys.has(slotKey);
                    // Dulled once the slot's actual instant has passed — covers both "this
                    // whole day is behind us" (every slot on it is already before `now`)
                    // and "today, but this hour already happened" with a single comparison,
                    // since `slot`/`now` are absolute instants regardless of which zone
                    // they're displayed in.
                    const isPastSlot = slot.getTime() < now.getTime();
                    // Also doubles as the sticky gutter button's own background below — a sticky
                    // cell needs an opaque fill of its own (it's out of the row's normal paint
                    // order), and using the row's actual color rather than a fixed one keeps the
                    // pinned time label matching whatever state the row it belongs to is in.
                    const rowBg = isRowSelected
                      ? "bg-tn-blue-bg"
                      : isPastSlot
                        ? "bg-black/10"
                        : "bg-tn-surface";
                    return (
                      <div
                        key={slotKey}
                        className={`grid min-h-16 ${rowBg}`}
                        style={{ gridTemplateColumns: dayGridColumns }}
                      >
                        <button
                          type="button"
                          disabled={isPastSlot}
                          onClick={() =>
                            setSelectedRowSlotKeys((keys) => {
                              const next = new Set(keys);
                              if (next.has(slotKey)) next.delete(slotKey);
                              else next.add(slotKey);
                              return next;
                            })
                          }
                          aria-pressed={isRowSelected}
                          aria-label={
                            isPastSlot
                              ? `${formatTimeLabel(slot, timezone)} has already passed — row selection isn't available for past times`
                              : `Select the ${formatTimeLabel(slot, timezone)} row`
                          }
                          className={`sticky left-0 z-[4] select-none border-none ${rowBg} p-2.5 text-left font-sans text-xs font-medium text-tn-muted-5 ${isRowSelected ? "text-tn-blue" : isPastSlot ? "cursor-not-allowed text-tn-faint-2" : ""} ${rowIndex < daySlots.length - 1 ? "border-b border-tn-border-soft" : ""}`}
                        >
                          {formatTimeLabel(slot, timezone)}
                        </button>
                        {dayColumns.map((member) => {
                          const booking = dayBookingsBySlot.get(`${member.id}__${hh}:${mm}`);
                          // Ghost columns (a staffUserId seen on a booking but no
                          // longer in the active roster) can't be picked as an
                          // "assign to" target for a *new* booking — only real,
                          // currently-active staff can.
                          const isActiveStaff = staff.some((s) => s.id === member.id);
                          // Greyed when this slot falls outside the member's shift for
                          // the day (see isSlotOutsideShift) — a visual "they're not
                          // scheduled then" cue, not a hard block: it stays clickable so
                          // an unplanned or one-off booking can still be added.
                          const outsideShift = !booking && isSlotOutsideShift(member.id, hh, mm);
                          return (
                            <div
                              key={member.id}
                              className={`border-l border-tn-border-soft p-2 ${rowIndex < daySlots.length - 1 ? "border-b border-tn-border-soft" : ""} ${outsideShift ? "bg-black/5" : ""}`}
                            >
                              {booking ? (
                                <button
                                  type="button"
                                  onClick={() => openBooking(booking)}
                                  className={`w-full rounded-md p-2 text-left font-sans text-xs font-medium text-tn-ink-soft ${BOOKING_STATUS_BLOCK[booking.status]}`}
                                >
                                  {booking.customerName}
                                  <br />
                                  {booking.serviceName}
                                </button>
                              ) : isActiveStaff ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setAddRequest({
                                      defaultDate: cursorDate,
                                      defaultStaffId: member.id,
                                      defaultTime: `${hh}:${mm}`,
                                    })
                                  }
                                  className="h-full w-full cursor-pointer rounded-md border border-dashed border-transparent text-transparent hover:border-tn-input-border hover:text-tn-faint-2"
                                  aria-label={
                                    outsideShift
                                      ? `Add booking for ${member.name} at ${formatTimeLabel(slot, timezone)} (outside their shift)`
                                      : `Add booking for ${member.name} at ${formatTimeLabel(slot, timezone)}`
                                  }
                                >
                                  +
                                </button>
                              ) : null}
                            </div>
                          );
                        })}
                        {canManageStaff && (
                          // The invite/ghost track (see the "One column per team
                          // member" overlay above) isn't tied to any staff member's
                          // time or booking state, so it shouldn't pick up the row's
                          // own `rowBg` (past-dulled / selected) tint. Without an
                          // explicit cell here, `dayColumns.map` above leaves that
                          // track's slice of the row empty, and the row div's own
                          // background — sized to span every `dayGridColumns` track,
                          // invite track included — shows through. This cell just
                          // paints over that slice with the neutral default so only
                          // real staff columns ever look dulled/selected.
                          // No `border-b` here (unlike the real staff cells) — this
                          // track has no per-slot content of its own, so the repeating
                          // hour dividers just read as a broken/half-finished grid;
                          // it reads cleaner as one continuous blank strip.
                          <div
                            className="border-l border-tn-border-soft bg-tn-surface"
                            style={{ gridColumn: Math.max(dayColumns.length, 1) + 2 }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right-edge fade cueing "there's more to scroll to" — fades out once the grid's
                  scrolled all the way, so it never sits there implying overflow that's gone. */}
              {dayHasOverflow && dayScrollProgress < 0.98 && (
                <div className="pointer-events-none absolute inset-y-0 right-0 z-[6] w-10 bg-gradient-to-l from-tn-surface to-transparent" />
              )}

              {dayHasOverflow && (
                <div className="flex items-center gap-2.5 border-t border-tn-border-softer bg-tn-page px-3 py-1.5">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-tn-border-soft">
                    <div
                      className="h-full rounded-full bg-tn-ink-soft"
                      style={{ width: `${Math.max(8, dayScrollProgress * 100)}%` }}
                    />
                  </div>
                  <span className="shrink-0 font-sans text-[10.5px] text-tn-muted-5">
                    {dayColumnsInView} of {dayColumns.length} columns in view
                  </span>
                </div>
              )}
            </div>

            {dayHasOverflow && dayScrollProgress < 0.98 && (
              <button
                type="button"
                onClick={() => jumpDayColumns(1)}
                aria-label="Scroll to more staff columns"
                className="fixed bottom-8 right-8 z-20 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-none bg-tn-dark text-tn-on-dark shadow-[0_14px_30px_-10px_rgba(40,30,10,0.5)]"
              >
                ›
              </button>
            )}
          </div>
        )}

        {view === "week" && (
          <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border">
            {/* Same self-scrolling-card-with-sticky-header pattern as Day view above, so a week with
                enough bookings to need scrolling still keeps MON..SUN pinned at the top. */}
            <div className="max-h-[640px] overflow-y-auto">
              <div className="sticky top-0 z-10 grid grid-cols-7 border-b border-tn-border-softer bg-tn-surface">
                {weekDays.map((day) => {
                  const isToday = isSameDay(day, new Date());
                  // Whole day already behind "today" — the past days at the start of
                  // this week's strip, dulled the same way Month view fades out days
                  // outside the current month.
                  const isPastDay = !isToday && day < startOfDay(new Date());
                  return (
                    <div
                      key={day.toDateString()}
                      className={`border-l border-tn-border-soft px-3 py-2.5 font-sans text-[11px] font-medium ${
                        isToday
                          ? "bg-tn-gold-bg-soft text-tn-gold font-semibold"
                          : isPastDay
                            ? "text-tn-faint-2"
                            : "text-tn-muted-5"
                      }`}
                    >
                      {formatWeekColumnLabel(day)}
                    </div>
                  );
                })}
              </div>
              <div className="grid min-h-[360px] grid-cols-7">
                {weekDays.map((day) => {
                  const dayBookings = bookingsByDay.get(day.toDateString()) ?? [];
                  const isPastDay = !isSameDay(day, new Date()) && day < startOfDay(new Date());
                  return (
                    <div
                      key={day.toDateString()}
                      className={`flex flex-col gap-1.5 border-l border-tn-border-soft p-2 ${isPastDay ? "bg-black/10" : ""}`}
                    >
                      {dayBookings.length === 0 && (
                        <span className="text-center font-sans text-[11px] text-tn-faint">
                          No bookings
                        </span>
                      )}
                      {dayBookings.map((booking) => (
                        <button
                          key={booking.id}
                          type="button"
                          onClick={() => setSelectedBooking(booking)}
                          className={`rounded-md p-1.5 text-left font-sans text-[11px] font-medium text-tn-ink-soft ${BOOKING_STATUS_BLOCK[booking.status]}`}
                        >
                          {formatTimeLabel(new Date(booking.startAt), timezone)}{" "}
                          {booking.customerName}
                          <br />
                          {booking.serviceName}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {view === "month" && (
          <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border">
            {/* Same sticky-header-in-a-scrollbox treatment as Day/Week above — a 6-week month
                (a month that spills into a leading/trailing week, see getMonthGrid) can run
                taller than the viewport, so MON..SUN needs to stay pinned while it scrolls. */}
            <div className="max-h-[640px] overflow-y-auto">
              <div className="sticky top-0 z-10 grid grid-cols-7 border-b border-tn-border-softer bg-tn-table-head">
                {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d) => (
                  <div
                    key={d}
                    className="px-5 py-4 font-sans text-[13px] font-semibold tracking-wide text-tn-muted-5"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div
                className="grid grid-cols-7"
                style={{ gridTemplateRows: `repeat(${monthWeeks.length}, 1fr)` }}
              >
                {monthWeeks.map((week) =>
                  week.map((day) => {
                    const isOut = !isSameMonth(day, cursorDate);
                    const isToday = isSameDay(day, new Date());
                    // Same "already happened" fade as Day/Week view, so a past date
                    // in the current month reads as past even though it's still
                    // "in month" (unlike isOut, which only flags the leading/trailing
                    // days that spill in from adjacent months).
                    const isPastDay = !isToday && day < startOfDay(new Date());
                    const count = bookingsByDay.get(day.toDateString())?.length ?? 0;
                    // Loosely-full days read as busier at a glance — matches the
                    // mockup's month grid, where 1-2 bookings sit in a muted
                    // gray chip and 3+ get the gold treatment.
                    const isBusy = count >= 3;
                    return (
                      <button
                        key={day.toDateString()}
                        type="button"
                        onClick={() => {
                          setNavDirection("fade");
                          setCursorDate(day);
                          setView("day");
                        }}
                        className={`flex min-h-[132px] cursor-pointer flex-col items-start gap-2 border-l border-t border-tn-border-soft p-4 text-left ${
                          isToday
                            ? "border-t-2 border-t-tn-gold bg-tn-gold-bg-soft"
                            : isPastDay
                              ? "bg-black/10 hover:bg-black/15"
                              : "hover:bg-tn-page"
                        }`}
                      >
                        <span
                          className={`font-sans text-[15px] ${
                            isOut
                              ? "font-medium text-tn-faint-2"
                              : isToday
                                ? "font-bold text-tn-gold"
                                : isPastDay
                                  ? "font-medium text-tn-faint-2"
                                  : "font-semibold text-tn-ink"
                          }`}
                        >
                          {day.getDate()}
                        </span>
                        {count > 0 && (
                          <span
                            className={`w-fit rounded-md px-3 py-1.5 font-sans text-xs font-medium ${
                              isBusy ? "bg-tn-gold-bg text-tn-gold" : "bg-tn-page text-tn-muted-3"
                            }`}
                          >
                            {count} booking{count === 1 ? "" : "s"}
                          </span>
                        )}
                      </button>
                    );
                  }),
                )}
              </div>
            </div>
          </div>
        )}

        {view === "list" && (
          <AppointmentListView
            accessToken={accessToken ?? ""}
            locationId={selectedLocationId}
            onOpenBooking={openBooking}
          />
        )}
      </div>

      <AppointmentModal
        open={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        booking={selectedBooking}
        staff={staff}
        accessToken={accessToken ?? ""}
        initialMode={selectedBookingMode}
      />

      <AddBookingModal
        open={!!addRequest}
        onClose={() => setAddRequest(null)}
        staff={staff}
        accessToken={accessToken ?? ""}
        defaultDate={addRequest?.defaultDate ?? cursorDate}
        defaultStaffId={addRequest?.defaultStaffId}
        defaultTime={addRequest?.defaultTime}
        timezone={timezone}
        locationId={selectedLocationId || undefined}
      />

      <ManageStaffSetsModal
        open={manageSetsOpen}
        onClose={() => setManageSetsOpen(false)}
        staffSets={staffSets}
        onRename={(staffSetId, name) =>
          updateStaffSetMutation.mutate({ id: staffSetId, patch: { name } })
        }
        onDelete={(staffSetId) => deleteStaffSetMutation.mutate(staffSetId)}
        onSetDefault={(staffSetId, isDefault) =>
          setDefaultStaffSetMutation.mutate({ id: staffSetId, isDefault })
        }
        onToggleShared={(staffSetId, isShared) =>
          updateStaffSetMutation.mutate({ id: staffSetId, patch: { isShared } })
        }
        onReorder={(staffSetIds) => reorderStaffSetsMutation.mutate(staffSetIds)}
      />
    </div>
  );
}

export default CalendarPage;
