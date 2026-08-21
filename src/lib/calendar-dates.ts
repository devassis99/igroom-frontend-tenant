/**
 * Pure date-math helpers for CalendarPage — Monday-start weeks throughout
 * (matches the mockup's MON..SUN week strip and month grid header), kept
 * framework-free so they're trivial to unit-test later.
 */

/**
 * True only for a string `Intl.DateTimeFormat` actually accepts as an IANA
 * zone (e.g. "America/Chicago") — everything else, including a location's
 * free-text TIMEZONE field (see AddEditLocationModal.tsx) if it was left
 * with garbage in it, is rejected. Constructing `Intl.DateTimeFormat` with
 * a bad `timeZone` throws a `RangeError` rather than returning false, so
 * this exists specifically so callers can fall back instead of crashing —
 * see CalendarPage.tsx's `timezone` derivation.
 */
export function isValidTimeZone(timeZone: string | null | undefined): timeZone is string {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setDate(1); // avoid Jan 31 + 1 month rolling into March
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Monday-based week start — JS's getDay() is Sunday-based (0-6), so Sunday shifts back 6 days instead of forward. */
export function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
}

export function endOfWeekExclusive(date: Date): Date {
  return addDays(startOfWeek(date), 7);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

const WEEKDAY_SHORT = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

/** e.g. "MON 10" — the Week view's column header. */
export function formatWeekColumnLabel(date: Date): string {
  return `${WEEKDAY_SHORT[date.getDay() === 0 ? 6 : date.getDay() - 1]} ${date.getDate()}`;
}

/** e.g. "Wed, Aug 12" — the Day view's nav label. */
export function formatDayNavLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** e.g. "Aug 10 – Aug 16" — the Week view's nav label. */
export function formatWeekNavLabel(date: Date): string {
  const start = startOfWeek(date);
  const end = addDays(start, 6);
  const startLabel = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endLabel =
    start.getMonth() === end.getMonth()
      ? end.toLocaleDateString("en-US", { day: "numeric" })
      : end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

/** e.g. "August 2026" — the Month view's nav label. */
export function formatMonthNavLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** e.g. "1:00 PM" for a booking's start/end time. Pass `timeZone` (an IANA name, e.g. "Asia/Karachi") to show it in a specific zone instead of the browser's own — see CalendarPage.tsx's timezone picker. */
export function formatTimeLabel(date: Date, timeZone?: string): string {
  return date
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      ...(timeZone ? { timeZone } : {}),
    })
    .replace(":00 ", " ");
}

/** e.g. "Wed, Aug 12 · 1:00 PM" for the appointment modal's detail rows. */
export function formatDateTimeLabel(date: Date, timeZone?: string): string {
  return `${formatDayNavLabel(date)} · ${formatTimeLabel(date, timeZone)}`;
}

/** e.g. "WEDNESDAY, AUG 12" — the List view's date-group headers. */
export function formatListDateHeader(date: Date, timeZone?: string): string {
  return date
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      ...(timeZone ? { timeZone } : {}),
    })
    .toUpperCase();
}

/**
 * Hour+minute of `date` as it reads on a clock in `timeZone` — plain
 * Date#getHours()/getMinutes() are always in the *browser's* zone, so
 * anything that needs to bucket a moment into a specific zone's wall-clock
 * (which slot row a booking falls in, expanding the Day view's visible
 * hour range) has to go through this instead. Falls back to the browser's
 * own zone when `timeZone` is omitted, matching every other helper here.
 */
export function zonedHourMinute(date: Date, timeZone?: string): { hour: number; minute: number } {
  if (!timeZone) return { hour: date.getHours(), minute: date.getMinutes() };
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { hour, minute };
}

/**
 * The UTC instant that reads as `hour`:`minute` on `year`-`month`-`day`
 * (month is 0-indexed, matching Date) when displayed in `timeZone` — the
 * inverse of zonedHourMinute. Needed so the Day view's row labels ("9:00
 * AM", "9:30 AM", ...) represent 9:00 AM *in the chosen timezone*, not
 * 9:00 AM browser-local re-labeled with the wrong zone's name on it.
 *
 * There's no built-in "give me the UTC instant for this zone's wall
 * clock" API, so this converges to it manually: guess an instant, check
 * what wall-clock time `timeZone` actually shows for that guess (Intl's
 * formatToParts already has the IANA tz database built into the JS
 * engine — no separate dependency needed), then correct the guess by
 * whatever gap remains. Two passes is enough even across a DST
 * transition, where the first pass's correction can itself land on a
 * different UTC offset.
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  let guess = new Date(Date.UTC(year, month, day, hour, minute));
  for (let i = 0; i < 2; i++) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(guess);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
    const observed = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour") % 24,
      get("minute"),
    );
    const target = Date.UTC(year, month, day, hour, minute);
    const diff = target - observed;
    if (diff === 0) break;
    guess = new Date(guess.getTime() + diff);
  }
  return guess;
}

/**
 * Monday-start weeks covering the full month plus leading/trailing days
 * so every row is a full 7 days — 5 rows most months, 6 for months that
 * spill over (e.g. a month starting on Saturday).
 */
export function getMonthGrid(date: Date): Date[][] {
  const gridStart = startOfWeek(startOfMonth(date));
  const lastOfMonth = endOfMonth(date);

  const weeks: Date[][] = [];
  let cursor = gridStart;
  do {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  } while (cursor <= lastOfMonth);

  return weeks;
}

/**
 * e.g. "GMT+5:30", "GMT-4", "GMT" — the Day view's corner label (matches
 * Google Calendar's own "GMT+00" style corner), so the grid's hour column
 * carries the zone's offset without needing the full IANA name spelled
 * out next to every row.
 */
export function formatUtcOffset(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value || "GMT";
  } catch {
    return "GMT";
  }
}

/**
 * Business-hours half-hour slots (9:00 AM – 7:00 PM) for a given day — the
 * Day view's grid rows. Pass `timeZone` so each slot's underlying instant
 * reads as that nominal hour/minute *in that zone* (via zonedTimeToUtc)
 * instead of in the browser's own zone — the row still lives on `date`'s
 * browser-local calendar day (Day view's day-membership stays
 * browser-local by design, see CalendarPage.tsx's timezone comment), only
 * the time-of-day within that day shifts to match the chosen zone.
 */
export function getDaySlots(
  date: Date,
  startHour = 9,
  endHour = 19,
  stepMinutes = 30,
  timeZone?: string,
): Date[] {
  const slots: Date[] = [];
  if (!timeZone) {
    const day = startOfDay(date);
    for (let minutes = startHour * 60; minutes < endHour * 60; minutes += stepMinutes) {
      slots.push(new Date(day.getTime() + minutes * 60_000));
    }
    return slots;
  }
  for (let minutes = startHour * 60; minutes < endHour * 60; minutes += stepMinutes) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    slots.push(
      zonedTimeToUtc(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, timeZone),
    );
  }
  return slots;
}
