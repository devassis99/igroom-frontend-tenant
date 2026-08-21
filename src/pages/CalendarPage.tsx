import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { LocationFilterPopover } from "@/components/ui/LocationFilterPopover";
import { TimezonePicker } from "@/components/ui/TimezonePicker";
import { AppointmentModal } from "@/components/calendar/AppointmentModal";
import { AppointmentListView } from "@/components/calendar/AppointmentListView";
import { AddBookingModal } from "@/components/calendar/AddBookingModal";
import { useAuthStore } from "@/auth/auth-store";
import {
  listBookings,
  listStaff,
  type Booking,
  type BookingsStaffMember,
} from "@/lib/bookings-api";
import { listLocations, type AccountLocation } from "@/lib/locations-api";
import { BOOKING_STATUS_BLOCK } from "@/lib/booking-status";
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
  isValidTimeZone,
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

// Fallback when neither the selected location nor an explicit override
// supplies one — same "last resort" tier as PhoneInput's DEFAULT_COUNTRY.
const BROWSER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Matches the Day view rows' own `min-h-16` (Tailwind's 4rem, i.e. 64px at
// the default root font size) — the red current-time line's pixel math
// below has to agree with that same row height or it'll drift out of
// alignment with the actual hour gridlines.
const DAY_SLOT_HEIGHT_PX = 64;

interface AddBookingRequest {
  defaultDate: Date;
  defaultStaffId?: string;
  defaultTime?: string;
}

/** Matches the mockup's T7 / T7-week / T7-month Calendar frames, plus the T7c/d/e appointment modal — now backed by real igroom-backend data instead of hardcoded arrays. */
export function CalendarPage() {
  const accessToken = useAuthStore((s) => s.accessToken);

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

  /** Opens the appointment modal straight into a given mode — the List view's inline Reschedule/Cancel row actions skip the extra click through the detail screen that the Day/Week/Month grid's plain click still goes through. */
  function openBooking(booking: Booking, mode: BookingModalMode = "detail") {
    setSelectedBooking(booking);
    setSelectedBookingMode(mode);
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
  // before the field existed) — or when it's configured but invalid: the
  // Locations form's own TIMEZONE field is still free text (see
  // AddEditLocationModal.tsx), so a typo like "saddsad" can end up saved
  // on a location, and every date helper below hands that straight to
  // `Intl.DateTimeFormat`, which throws rather than failing gracefully.
  // Validating here means one bad location falls back to the browser's
  // zone instead of taking down the whole Calendar page.
  const selectedLocation = locations.find((l) => l.id === selectedLocationId);
  const locationTimezone = isValidTimeZone(selectedLocation?.timezone)
    ? selectedLocation.timezone
    : null;
  const timezone = timezoneOverride ?? locationTimezone ?? BROWSER_TIMEZONE;

  // Default to the account's primary location the moment the list loads —
  // same "default to primary, let them change it" pattern as
  // AddMemberWizard's own location field.
  useEffect(() => {
    if (selectedLocationId || locations.length === 0) return;
    setSelectedLocationId(locations.find((l) => l.isPrimary)?.id ?? locations[0]!.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the list itself changes
  }, [locations]);

  const staffQuery = useQuery({
    queryKey: ["bookings-staff", selectedLocationId],
    queryFn: () => listStaff(accessToken ?? "", selectedLocationId || undefined),
    enabled: !!accessToken,
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
    enabled: !!accessToken && view !== "list",
    // The previous range's bookings stay on screen (fading/sliding out
    // under the transition below) while the new range loads, instead of
    // the grid flashing empty for a beat on every date/view/location
    // change.
    placeholderData: keepPreviousData,
  });
  const bookings = bookingsQuery.data?.bookings ?? EMPTY_BOOKINGS;

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
   * The grid defaults to business hours (9am–7pm), but a booking outside
   * that window must still be visible — otherwise it silently vanishes
   * from Day view while still showing up fine in Week/Month (which have
   * no hour restriction at all). So the bounds expand to cover whatever
   * bookings actually exist on the visible day.
   */
  const daySlots = useMemo(() => {
    let minHour = 9;
    let maxHour = 19;
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
  }, [cursorDate, bookings, timezone]);

  /**
   * Columns for the Day view. Bookings only ever come back from the API
   * for staff who exist (bookings.service inner-joins staff_users), but
   * the *active* roster (`staff`, from /bookings/staff) can still exclude
   * a staff member who was deactivated after the booking was made — the
   * booking would then have no column to render into and disappear from
   * Day view while Week/Month (which don't key off the roster at all)
   * kept showing it fine. So any staffUserId seen on today's bookings
   * gets a column too, even if it's fallen out of the active roster.
   */
  const dayColumns = useMemo(() => {
    const known = new Map(staff.map((member) => [member.id, member]));
    for (const booking of bookings) {
      if (!known.has(booking.staffUserId)) {
        known.set(booking.staffUserId, {
          id: booking.staffUserId,
          name: booking.staffName,
          role: "",
        });
      }
    }
    return Array.from(known.values());
  }, [staff, bookings]);

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

  // Lands the current time roughly a third of the way down the visible
  // grid on entering Day view or switching days — same landing spot
  // Google Calendar's Day view opens to — rather than requiring a manual
  // scroll to find "now". Deliberately NOT re-run on every `now` tick
  // (see deps below) so it doesn't yank the user's scroll position back
  // out from under them every 30 seconds while they're looking at it.
  useEffect(() => {
    if (view !== "day" || nowLineOffsetPx === null || !dayScrollRef.current) return;
    const container = dayScrollRef.current;
    container.scrollTop = Math.max(0, nowLineOffsetPx - container.clientHeight / 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally excludes nowLineOffsetPx/daySlots so re-renders while viewing don't reset scroll
  }, [view, cursorDate, timezone]);

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

      <div
        key={`${view}-${selectedLocationId}-${cursorDate.toDateString()}`}
        style={{ animation: gridAnimation }}
      >
        {view === "day" && (
          <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border">
            {/* Fixed-height, self-scrolling grid (independent of the page's own scroll container) so the
                header row below can stay pinned while the hour rows scroll under it, and so the
                auto-scroll-to-now effect has a predictable container to act on. */}
            <div ref={dayScrollRef} className="max-h-[640px] overflow-y-auto">
              <div
                className="sticky top-0 z-10 grid border-b border-tn-border-softer bg-tn-surface"
                style={{
                  gridTemplateColumns: `70px repeat(${Math.max(dayColumns.length, 1)}, 1fr)`,
                }}
              >
                <div className="p-2 font-sans text-[11px] font-medium text-tn-muted-5">
                  {formatUtcOffset(timezone)}
                </div>
                {staffQuery.isPending && (
                  <div className="border-l border-tn-border-soft p-3 font-sans text-[13px] text-tn-muted-5">
                    Loading staff…
                  </div>
                )}
                {!staffQuery.isPending && dayColumns.length === 0 && (
                  <div className="border-l border-tn-border-soft p-3 font-sans text-[13px] text-tn-muted-5">
                    No active staff at this location yet — add staff in Settings.
                  </div>
                )}
                {dayColumns.map((member) => (
                  <div
                    key={member.id}
                    className="border-l border-tn-border-soft p-3 font-sans text-[13px] font-semibold text-tn-ink"
                  >
                    {member.name}
                  </div>
                ))}
              </div>

              <div className="relative">
                {/* Google Calendar-style "now" line — a dot at the hour gutter's right edge plus a line
                    spanning the staff columns, positioned in px (see DAY_SLOT_HEIGHT_PX/nowLineOffsetPx)
                    rather than as a real grid row, so it can sit *between* two rows without disturbing
                    the booking grid's own layout. */}
                {nowLineOffsetPx !== null && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-[5]"
                    style={{ top: nowLineOffsetPx }}
                  >
                    <div className="flex items-center" style={{ marginLeft: 70 }}>
                      <span className="h-2.5 w-2.5 shrink-0 -translate-x-1/2 rounded-full bg-tn-danger" />
                      <span className="h-px flex-1 bg-tn-danger" />
                    </div>
                  </div>
                )}

                {daySlots.map((slot, rowIndex) => {
                  const slotZoned = zonedHourMinute(slot, timezone);
                  const hh = String(slotZoned.hour).padStart(2, "0");
                  const mm = String(slotZoned.minute).padStart(2, "0");
                  return (
                    <div
                      key={slot.toISOString()}
                      className="grid min-h-16"
                      style={{
                        gridTemplateColumns: `70px repeat(${Math.max(dayColumns.length, 1)}, 1fr)`,
                      }}
                    >
                      <div
                        className={`p-2.5 font-sans text-xs font-medium text-tn-muted-5 ${rowIndex < daySlots.length - 1 ? "border-b border-tn-border-soft" : ""}`}
                      >
                        {formatTimeLabel(slot, timezone)}
                      </div>
                      {dayColumns.map((member) => {
                        const booking = dayBookingsBySlot.get(`${member.id}__${hh}:${mm}`);
                        // Ghost columns (a staffUserId seen on a booking but no
                        // longer in the active roster) can't be picked as an
                        // "assign to" target for a *new* booking — only real,
                        // currently-active staff can.
                        const isActiveStaff = staff.some((s) => s.id === member.id);
                        return (
                          <div
                            key={member.id}
                            className={`border-l border-tn-border-soft p-2 ${rowIndex < daySlots.length - 1 ? "border-b border-tn-border-soft" : ""}`}
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
                                aria-label={`Add booking for ${member.name} at ${formatTimeLabel(slot, timezone)}`}
                              >
                                +
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {view === "week" && (
          <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border">
            {/* Same self-scrolling-card-with-sticky-header pattern as Day view above, so a week with
                enough bookings to need scrolling still keeps MON..SUN pinned at the top. */}
            <div className="max-h-[640px] overflow-y-auto">
              <div className="sticky top-0 z-10 grid grid-cols-7 border-b border-tn-border-softer bg-tn-surface">
                {weekDays.map((day) => (
                  <div
                    key={day.toDateString()}
                    className={`border-l border-tn-border-soft px-3 py-2.5 font-sans text-[11px] font-medium ${
                      isSameDay(day, new Date())
                        ? "bg-tn-gold-bg-soft text-tn-gold font-semibold"
                        : "text-tn-muted-5"
                    }`}
                  >
                    {formatWeekColumnLabel(day)}
                  </div>
                ))}
              </div>
              <div className="grid min-h-[360px] grid-cols-7">
                {weekDays.map((day) => {
                  const dayBookings = bookingsByDay.get(day.toDateString()) ?? [];
                  return (
                    <div
                      key={day.toDateString()}
                      className="flex flex-col gap-1.5 border-l border-tn-border-soft p-2"
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
                            : "hover:bg-tn-page"
                        }`}
                      >
                        <span
                          className={`font-sans text-[15px] ${
                            isOut
                              ? "font-medium text-tn-faint-2"
                              : isToday
                                ? "font-bold text-tn-gold"
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
      />
    </div>
  );
}

export default CalendarPage;
