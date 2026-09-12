import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ArrivedDot } from "@/components/calendar/ArrivedDot";
import { useAnchoredPanel } from "@/components/ui/use-anchored-panel";
import type { Booking } from "@/lib/bookings-api";
import {
  calendarDateKey,
  formatTimeLabel,
  formatUtcOffset,
  zonedHourMinute,
} from "@/lib/calendar-dates";
import { staffAvatarColorStrong } from "@/lib/staff-avatar-color";
import { todayIsoIn } from "@/lib/timezones";

/**
 * One hour of the week, in pixels.
 *
 * Deliberately shorter than Day view's row (DAY_SLOT_HEIGHT_PX, which is
 * 64px for *half* an hour): seven columns have to fit side by side, and a
 * week is read for shape — where the day is busy, where it is empty —
 * rather than for the twenty minutes between two appointments.
 */
const HOUR_PX = 56;

/** A 15-minute booking still needs to be clickable and hold two lines. */
const MIN_CARD_PX = 38;

/**
 * The dashed "+N" chip beside a stack, and the gap before it.
 *
 * Narrow on purpose. Seven columns in a 1200px card leaves each one
 * about 170px, and every pixel this takes comes out of the client's
 * name — the one thing on the card nobody can guess from context. 28px
 * still reads "+2" at 11px and still takes a click.
 */
const STACK_CHIP_PX = 28;
const STACK_GAP_PX = 3;

/**
 * Breathing room above the first hour.
 *
 * The hour labels sit *on* their line rather than inside the row below
 * it, which is right everywhere except the first one — at top: 0 its own
 * half-height translate puts it outside the scroll box and it renders
 * sheared in half.
 */
const GRID_TOP_PAD = 12;

/** The window the grid falls back to when a week has no bookings to size it from. */
const DEFAULT_START_HOUR = 9;
const DEFAULT_END_HOUR = 19;

/** Minutes from the shop's own midnight — not the viewer's, and not UTC. */
function minutesOfDay(iso: string, timezone: string | undefined): number {
  const { hour, minute } = zonedHourMinute(new Date(iso), timezone);
  return hour * 60 + minute;
}

/**
 * Where a booking sits in its day, clamped to that day.
 *
 * A booking that runs past midnight has an `endAt` whose wall clock is
 * *smaller* than its start, and one that started yesterday evening has
 * the reverse. Both would otherwise produce a negative height or a card
 * hanging off the top of the column, so each is clipped to the day it is
 * being drawn in — the part outside belongs to a column that isn't this
 * one.
 */
function spanOf(booking: Booking, timezone: string | undefined): { from: number; to: number } {
  const from = minutesOfDay(booking.startAt, timezone);
  const rawTo = minutesOfDay(booking.endAt, timezone);
  const to = rawTo <= from ? 24 * 60 : rawTo;
  return { from, to };
}

export interface WeekStack {
  /** Everything in this run of overlapping bookings, earliest first. */
  bookings: Booking[];
  from: number;
  to: number;
}

/**
 * Bookings grouped into runs that overlap in time.
 *
 * Overlap here means the clock, not the barber. Two cuts at noon with
 * two different barbers are not a clash — the shop has two chairs — but
 * they are still two cards fighting for the same 56 pixels, which is the
 * problem this solves. A run extends as long as the next booking starts
 * before the run's furthest end so far, so three appointments chained
 * 12:00–13:00, 12:30–13:30, 13:00–14:00 are one stack rather than two
 * overlapping pairs drawn on top of each other.
 */
export function stacksFor(bookings: Booking[], timezone: string | undefined): WeekStack[] {
  /**
   * Earliest first, and on a tie the *longest* first.
   *
   * The first booking in a run becomes the card that gets drawn, so the
   * tie-break decides what the column looks like. Shortest-first put a
   * 15-minute card at the head of a two-hour block: a stub of a card
   * beside a tall dashed counter, which read as though the empty
   * placeholder were the appointment. The longest booking is also the
   * honest one to show — it is the one that says how long the chair is
   * actually taken.
   */
  const spans = bookings
    .map((booking) => ({ booking, ...spanOf(booking, timezone) }))
    .sort((a, b) => a.from - b.from || b.to - a.to);

  const stacks: WeekStack[] = [];
  for (const entry of spans) {
    const current = stacks.at(-1);
    if (current && entry.from < current.to) {
      current.bookings.push(entry.booking);
      current.to = Math.max(current.to, entry.to);
      continue;
    }
    stacks.push({ bookings: [entry.booking], from: entry.from, to: entry.to });
  }
  return stacks;
}

/**
 * The hours worth *looking at* — not the hours drawn.
 *
 * The grid draws all twenty-four, because anything narrower is an hour a
 * manager cannot reach: a week sized to its own bookings had no 8am row
 * until something was already booked at 8, which is exactly when you
 * can't book it. So the window below only decides where the grid is
 * scrolled to when it opens.
 *
 * Sized from the week's bookings rather than from the rota: Day view can
 * ask for one day's shifts and does, but a week would need seven, and
 * what a manager is looking for in Week view is where the work is.
 */
export function weekHourRange(
  bookings: Booking[],
  timezone: string | undefined,
): { startHour: number; endHour: number } {
  let startHour = DEFAULT_START_HOUR;
  let endHour = DEFAULT_END_HOUR;
  for (const booking of bookings) {
    const { from, to } = spanOf(booking, timezone);
    startHour = Math.min(startHour, Math.floor(from / 60));
    endHour = Math.max(endHour, Math.ceil(to / 60));
  }
  return {
    startHour: Math.max(0, startHour),
    endHour: Math.min(24, Math.max(endHour, startHour + 1)),
  };
}

/** "9 AM", "12 PM", "1 PM" — the gutter's labels, built from the hour number alone. */
function hourLabel(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 || 12;
  return `${h} ${period}`;
}

/** MON / 7 — the two lines in a column header. */
function dayHeadingParts(day: Date): { weekday: string; dayNumber: string } {
  return {
    weekday: day.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase(),
    dayNumber: String(day.getDate()),
  };
}

export function WeekGrid({
  days,
  bookingsByDay,
  timezone,
  weekBookings,
  onSelectBooking,
  onOpenDay,
}: {
  days: Date[];
  bookingsByDay: ReadonlyMap<string, Booking[]>;
  timezone: string | undefined;
  /** Every booking in the visible week — what the hour range is sized from. */
  weekBookings: Booking[];
  onSelectBooking: (booking: Booking) => void;
  /** Jump to Day view on this date — the "see the whole picture" escape from a stack. */
  onOpenDay: (day: Date) => void;
}) {
  const { startHour } = useMemo(
    () => weekHourRange(weekBookings, timezone),
    [weekBookings, timezone],
  );
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const gridHeight = hours.length * HOUR_PX + GRID_TOP_PAD;

  /**
   * Opens on the working day and scrolls anywhere from there.
   *
   * Re-aimed when the week changes, and deliberately not when a booking
   * is added or the staff filter narrows — the grid yanking itself back
   * to 9am because somebody unticked a barber is worse than being left
   * where they were looking. `weekKey` is the Monday, so it only fires on
   * an actual navigation.
   */
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const weekKey = days[0]?.toDateString() ?? "";
  const startHourRef = useRef(startHour);
  startHourRef.current = startHour;
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTop = Math.max(0, startHourRef.current * HOUR_PX + GRID_TOP_PAD - HOUR_PX / 2);
  }, [weekKey]);

  /** The shop's today, not the viewer's — near midnight they are different days. */
  const todayKey = todayIsoIn(timezone ?? null);

  /**
   * Where "now" falls in the grid — always somewhere, since the grid
   * spans the whole day. Recomputed on render rather than ticking: the
   * page already refetches often enough that a line a render stale is
   * closer than the minute hand a manager reads it against.
   */
  const nowOffsetPx = useMemo(() => {
    const { hour, minute } = zonedHourMinute(new Date(), timezone);
    return ((hour * 60 + minute) / 60) * HOUR_PX + GRID_TOP_PAD;
  }, [timezone]);

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border">
      {/* One scroll box for header and body together, so MON..SUN stays
          pinned while the hours scroll under it — the same arrangement
          Day and Month use. */}
      <div ref={scrollRef} className="max-h-[640px] overflow-y-auto">
        {/* Built like Day view's header rather than as its own thing: same
            filled band, same offset badge in the corner, same
            name-over-detail pair in each column. The two sit behind one
            view switcher, and a header that changes shape when you press
            Week reads as a different screen. */}
        <div
          className="sticky top-0 z-20 grid border-b border-tn-border-softer bg-tn-table-head"
          style={{ gridTemplateColumns: `56px repeat(7, minmax(0, 1fr))` }}
        >
          <div className="flex items-center justify-center border-r border-tn-border-soft p-2 text-center font-sans text-[11px] font-medium text-tn-muted-5">
            {formatUtcOffset(timezone ?? "UTC")}
          </div>
          {days.map((day) => {
            const count = (bookingsByDay.get(calendarDateKey(day)) ?? []).length;
            const isToday = calendarDateKey(day) === todayKey;
            const isPast = !isToday && calendarDateKey(day) < todayKey;
            const { weekday, dayNumber } = dayHeadingParts(day);
            return (
              <div
                key={day.toDateString()}
                className={`flex min-w-0 flex-col justify-center border-l border-tn-border-soft p-3 ${
                  isToday ? "bg-tn-gold-bg-soft" : ""
                }`}
              >
                <span
                  className={`truncate font-sans text-[13px] font-semibold ${
                    isToday ? "text-tn-gold" : isPast ? "text-tn-faint-2" : "text-tn-ink"
                  }`}
                >
                  {weekday} {dayNumber}
                </span>
                {/* Day view's second line is the barber's hours and their
                    count; a week column's equivalent is simply how much is
                    in it — which a stacked column deliberately hides, so
                    this is the one number that always tells the truth. */}
                <span
                  className={`truncate font-sans text-[10.5px] ${
                    isPast ? "text-tn-faint-2" : "text-tn-muted-5"
                  }`}
                >
                  {count === 0 ? "No bookings" : `${count} booking${count === 1 ? "" : "s"}`}
                </span>
              </div>
            );
          })}
        </div>

        <div
          className="relative grid"
          style={{ gridTemplateColumns: `56px repeat(7, minmax(0, 1fr))`, height: gridHeight }}
        >
          {/* The gutter. Labels sit on the line rather than inside the row
              so an appointment at 12:00 reads against the 12 PM rule. */}
          <div className="relative border-r border-tn-border-soft">
            {hours.map((hour, index) => (
              <span
                key={hour}
                className="absolute right-2 -translate-y-1/2 font-sans text-[10px] text-tn-faint"
                style={{ top: index * HOUR_PX + GRID_TOP_PAD }}
              >
                {hourLabel(hour)}
              </span>
            ))}
          </div>

          {days.map((day) => {
            const dayBookings = bookingsByDay.get(calendarDateKey(day)) ?? [];
            const isToday = calendarDateKey(day) === todayKey;
            const stacks = stacksFor(dayBookings, timezone);
            return (
              /* No wash on a past day. It was a flat black overlay, and on
                 a quiet week that turned Monday to Thursday into four grey
                 slabs — which reads as "broken" long before it reads as
                 "already happened". The dulled header is enough; the
                 bookings in a past column are still real bookings and
                 shouldn't be greyed out with it. */
              <div
                key={day.toDateString()}
                className={`relative border-l border-tn-border-soft ${
                  isToday ? "bg-tn-gold-bg-soft" : ""
                }`}
              >
                {/* Hour rules, drawn per column rather than as one overlay
                    so they sit under the cards and stop at the column edge. */}
                {hours.map((hour, index) =>
                  index === 0 ? null : (
                    <div
                      key={hour}
                      className="pointer-events-none absolute inset-x-0 border-t border-tn-border-softer"
                      style={{ top: index * HOUR_PX + GRID_TOP_PAD }}
                    />
                  ),
                )}

                {isToday && (
                  /* The same red hairline Day view draws, for the same
                     reason: "where are we" is the first question asked of
                     a calendar, and on a week it also says which of the
                     seven columns is live. */
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 z-10 border-t border-tn-danger"
                    style={{ top: nowOffsetPx }}
                  >
                    <span className="absolute -top-[3px] -left-[3px] size-1.5 rounded-full bg-tn-danger" />
                  </div>
                )}

                {stacks.map((stack) => (
                  <StackCards
                    key={`${stack.from}-${stack.bookings[0]!.id}`}
                    stack={stack}
                    day={day}
                    timezone={timezone}
                    onSelectBooking={onSelectBooking}
                    onOpenDay={onOpenDay}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * One run of overlapping bookings: the first card, and a count for the rest.
 *
 * The alternative — splitting the hour into a lane per booking — keeps
 * every card visible and a week at seven columns cannot afford it: three
 * barbers at noon leaves each card about forty pixels wide, which is not
 * enough for a name. So the week stays scannable and the count carries
 * the rest; the popover below is where "who else is in at noon" gets
 * answered, and Day view is one click further for the full picture.
 */
function StackCards({
  stack,
  day,
  timezone,
  onSelectBooking,
  onOpenDay,
}: {
  stack: WeekStack;
  day: Date;
  timezone: string | undefined;
  onSelectBooking: (booking: Booking) => void;
  onOpenDay: (day: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const chipRef = useRef<HTMLButtonElement | null>(null);

  const lead = stack.bookings[0]!;
  const hidden = stack.bookings.length - 1;
  const { from, to } = spanOf(lead, timezone);
  const top = (from / 60) * HOUR_PX + GRID_TOP_PAD;
  const height = Math.max(MIN_CARD_PX, ((to - from) / 60) * HOUR_PX);

  return (
    <>
      <button
        type="button"
        onClick={() => onSelectBooking(lead)}
        title={`${formatTimeLabel(new Date(lead.startAt), timezone)} · ${lead.customerName} · ${lead.staffName} · ${lead.serviceName}`}
        className="absolute flex flex-col overflow-hidden rounded-lg border-l-[3px] bg-tn-surface px-1.5 py-1 text-left shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-shadow hover:shadow-[0_2px_6px_rgba(0,0,0,0.10)]"
        style={{
          top,
          height,
          left: 3,
          right: hidden > 0 ? STACK_CHIP_PX + STACK_GAP_PX + 3 : 3,
          borderLeftColor: staffAvatarColorStrong(lead.staffUserId),
        }}
      >
        {/* The client's name is the line that has to survive a narrow
            column, so it gets its own full width and everything else
            shares a line with something. A card shorter than about two
            rows only has room for the name — a 15-minute appointment
            showing a truncated time and nothing else is worse than
            showing who it is. */}
        <span className="flex items-baseline gap-1 truncate font-sans text-[11.5px] font-semibold text-tn-ink">
          <ArrivedDot checkedInAt={lead.checkedInAt} />
          <span className="truncate">{lead.customerName}</span>
        </span>
        {height >= MIN_CARD_PX + 12 && (
          <span className="truncate font-sans text-[10px] text-tn-faint">
            {formatTimeLabel(new Date(lead.startAt), timezone)} · {lead.staffName}
          </span>
        )}
        {height >= MIN_CARD_PX + 30 && (
          <span className="truncate font-sans text-[10.5px] text-tn-muted-5">
            {lead.serviceName}
          </span>
        )}
      </button>

      {hidden > 0 && (
        <button
          ref={chipRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={`${hidden} more booking${hidden === 1 ? "" : "s"} at this time`}
          className="absolute flex items-center justify-center rounded-lg border border-dashed border-tn-border font-sans text-[11px] font-semibold text-tn-muted-5 transition-colors hover:border-tn-ink-soft hover:text-tn-ink"
          /* Sized to the card it belongs to, not to the run.
             Stretched over the whole run, a short lead beside a long
             sibling produced a dashed box several times the height of
             the only real card on screen — the counter looked like the
             appointment and the appointment looked like a mistake. */
          style={{ top, height, right: 3, width: STACK_CHIP_PX }}
        >
          +{hidden}
        </button>
      )}

      {open && (
        <StackPopover
          anchorRef={chipRef}
          stack={stack}
          day={day}
          timezone={timezone}
          onClose={() => setOpen(false)}
          onSelectBooking={(booking) => {
            setOpen(false);
            onSelectBooking(booking);
          }}
          onOpenDay={() => {
            setOpen(false);
            onOpenDay(day);
          }}
        />
      )}
    </>
  );
}

/**
 * Everything in the hour, as rows.
 *
 * A popover rather than a jump to Day view, because most clicks on a
 * count are "who else is in at noon?" and not "take me somewhere else" —
 * answering the first by navigating away loses the week the manager was
 * reading. Day view is still one button away for the times it really was
 * the second question.
 */
function StackPopover({
  anchorRef,
  stack,
  day,
  timezone,
  onClose,
  onSelectBooking,
  onOpenDay,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  stack: WeekStack;
  day: Date;
  timezone: string | undefined;
  onClose: () => void;
  onSelectBooking: (booking: Booking) => void;
  onOpenDay: () => void;
}) {
  const position = useAnchoredPanel(true, anchorRef, { width: 260, minHeight: 140 });
  if (!position) return null;

  return createPortal(
    <>
      {/* Catches the click that should close this without needing a
          document listener that would also swallow the chip's own click. */}
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      {/* A named region rather than a dialog: it is anchored to the chip
          that opened it (which carries aria-expanded), it traps nothing,
          and calling it a dialog promised a focus contract this doesn't
          keep. A <section> with a label needs no role attribute at all —
          the element already is one. */}
      <section
        aria-label={`Bookings at ${formatTimeLabel(new Date(stack.bookings[0]!.startAt), timezone)}`}
        className="fixed z-50 flex flex-col overflow-hidden rounded-xl border border-tn-border bg-tn-surface shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        style={{
          left: position.left,
          top: position.top,
          bottom: position.bottom,
          width: position.width,
          maxHeight: position.maxHeight,
        }}
      >
        <div className="border-b border-tn-border-softer px-3 py-2">
          <span className="block font-sans text-[11px] font-semibold text-tn-ink">
            {day.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })} ·{" "}
            {formatTimeLabel(new Date(stack.bookings[0]!.startAt), timezone)}
          </span>
          <span className="block font-sans text-[10.5px] text-tn-faint">
            {stack.bookings.length} in the chair at once
          </span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {stack.bookings.map((booking) => (
            <button
              key={booking.id}
              type="button"
              onClick={() => onSelectBooking(booking)}
              // The row reads as a colour dot, a name and a service, none
              // of which a screen reader can assemble into "open this
              // one" — so the button says what it does.
              aria-label={`Open ${booking.customerName}'s ${booking.serviceName} with ${booking.staffName}`}
              className="flex w-full items-start gap-2 border-b border-tn-border-softer px-3 py-2 text-left last:border-b-0 hover:bg-tn-page"
            >
              <span
                aria-hidden
                className="mt-1 size-2 flex-none rounded-full"
                style={{ backgroundColor: staffAvatarColorStrong(booking.staffUserId) }}
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-sans text-[11.5px] font-semibold text-tn-ink">
                  <ArrivedDot checkedInAt={booking.checkedInAt} />
                  {booking.customerName}
                </span>
                <span className="truncate font-sans text-[10.5px] text-tn-muted-5">
                  {booking.staffName} · {booking.serviceName}
                </span>
                <span className="truncate font-sans text-[10px] text-tn-faint">
                  {formatTimeLabel(new Date(booking.startAt), timezone)} –{" "}
                  {formatTimeLabel(new Date(booking.endAt), timezone)}
                </span>
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onOpenDay}
          className="border-t border-tn-border-softer bg-tn-page px-3 py-2 text-left font-sans text-[11px] font-semibold text-tn-ink hover:bg-tn-surface"
        >
          Open this day →
        </button>
      </section>
    </>,
    document.body,
  );
}

export default WeekGrid;
