/**
 * Pure date-math helpers for CalendarPage — Monday-start weeks throughout
 * (matches the mockup's MON..SUN week strip and month grid header), kept
 * framework-free so they're trivial to unit-test later.
 */

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

/** e.g. "1:00 PM" for a booking's start/end time. */
export function formatTimeLabel(date: Date): string {
  return date
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .replace(":00 ", " ");
}

/** e.g. "Wed, Aug 12 · 1:00 PM" for the appointment modal's detail rows. */
export function formatDateTimeLabel(date: Date): string {
  return `${formatDayNavLabel(date)} · ${formatTimeLabel(date)}`;
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

/** Business-hours half-hour slots (9:00 AM – 7:00 PM) for a given day — the Day view's grid rows. */
export function getDaySlots(date: Date, startHour = 9, endHour = 19, stepMinutes = 30): Date[] {
  const slots: Date[] = [];
  const day = startOfDay(date);
  for (let minutes = startHour * 60; minutes < endHour * 60; minutes += stepMinutes) {
    slots.push(new Date(day.getTime() + minutes * 60_000));
  }
  return slots;
}
