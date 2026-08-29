/**
 * Reading one shop's wall clock in another shop's.
 *
 * A saved schedule is wall-clock time with no zone attached — "Monday
 * 09:00" is nine in the morning at whichever shop the row belongs to
 * (see the backend's staff-availability.ts). That is exactly right for
 * editing one shop's week and exactly useless for answering "can she
 * also be at Valencia that afternoon", which is a question about
 * instants. These helpers do the one conversion the availability
 * editor's cross-shop note needs, and nothing else.
 *
 * Advisory, not authoritative: the note these feed never blocks a save
 * (a member's shops are theirs to sequence), so an hour's slip across a
 * DST boundary would mislead nobody into a rejected write. The offsets
 * are still read at the actual upcoming date rather than "now" so a
 * conversion made in January doesn't quietly describe July.
 */

const MINUTES_PER_DAY = 24 * 60;

/** e.g. "UTC+1", "UTC+5:30", "UTC" — the label the shop tabs carry, so two shops can be told apart at a glance rather than by city name alone. */
export function utcOffsetLabel(zone: string | null): string {
  if (!zone) return "UTC";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    return raw.replace("GMT", "UTC") || "UTC";
  } catch {
    return "UTC";
  }
}

/** e.g. "PKT", "GMT+4" — the short zone name the mockup puts after each row's times, so a row states its own clock without repeating the whole IANA id. Intl falls back to a numeric form for zones with no common abbreviation, which is fine: it is still unambiguous. */
export function zoneAbbreviation(zone: string | null): string {
  if (!zone) return "UTC";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "short",
    }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "UTC";
  } catch {
    return "UTC";
  }
}

/** Friendly last segment of an IANA id — "Asia/Karachi" -> "Karachi". Same treatment TimezonePicker gives its rows. */
export function friendlyZoneLabel(zone: string | null): string {
  if (!zone) return "UTC";
  return (zone.split("/").pop() ?? zone).replace(/_/g, " ");
}

/**
 * Minutes east of UTC for `zone` at `at`.
 *
 * Read off Intl's own shortOffset rather than kept in a table, so a zone
 * whose rules change — or one that is simply on summer time that week —
 * reports what it will actually be, not what it was when this shipped.
 * An unset or unusable zone is UTC, matching what the backend's
 * resolveTimeZone does with the same value.
 */
export function zoneOffsetMinutes(zone: string | null, at: Date = new Date()): number {
  if (!zone) return 0;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "longOffset",
    }).formatToParts(at);
    const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    // "GMT+05:30", "GMT-08:00", or plain "GMT" at zero.
    const match = /GMT([+-])(\d{2}):?(\d{2})?/.exec(raw);
    if (!match) return 0;
    const sign = match[1] === "-" ? -1 : 1;
    return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0));
  } catch {
    return 0;
  }
}

/** "09:30" -> 570. The one place time strings become comparable numbers. */
export function toMinutes(hhmm: string): number {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** 570 -> "09:30", wrapping past a day boundary so a converted time reads as a time rather than "26:30". */
export function fromMinutes(minutes: number): string {
  const wrapped = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "14:00" -> "2:00 PM". The cross-shop note reads as prose, so it uses the 12-hour clock the mockup's copy does, while the editable fields stay 24h like the rest of the app. */
export function to12Hour(hhmm: string): string {
  const total = toMinutes(hhmm);
  const h24 = Math.floor(total / 60) % 24;
  const m = total % 60;
  const suffix = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/**
 * The next date (UTC noon, so no zone's local date can slip either way
 * off it) on which `dayOfWeek` falls. Used only to pick the moment whose
 * offsets a conversion should use — a Wednesday in March and a
 * Wednesday in August can differ by an hour, and picking the upcoming
 * one is what makes the note describe the week the owner is editing.
 */
function nextOccurrenceOf(dayOfWeek: number, from: Date = new Date()): Date {
  const base = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 12);
  const delta = (dayOfWeek - new Date(base).getUTCDay() + 7) % 7;
  return new Date(base + delta * 24 * 60 * 60 * 1000);
}

/**
 * The wall clock `instant` shows on `zone` — "HH:mm", 24-hour.
 *
 * The reverse of everything else here, and needed for exactly one job:
 * the collision panel's trim buttons compute a new boundary on the UTC
 * timeline (where the two shops can be compared at all) and then have to
 * write it back into a field the manager reads in local time.
 */
export function wallClockAt(instant: Date, zone: string | null): string {
  if (!zone) {
    return `${String(instant.getUTCHours()).padStart(2, "0")}:${String(instant.getUTCMinutes()).padStart(2, "0")}`;
  }
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(instant);
    const at = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
    // Intl reports midnight as "24" in some locales.
    const hour = at("hour") === "24" ? "00" : at("hour");
    return `${hour}:${at("minute")}`;
  } catch {
    return wallClockAt(instant, null);
  }
}

export interface ConvertedRange {
  startTime: string;
  endTime: string;
  /**
   * -1, 0 or 1 — which day the converted range lands on relative to the
   * one it was written for. A Soho afternoon read in Karachi can run
   * past local midnight, and dropping that would turn a range that
   * spills into Thursday into a Wednesday one that appears to end
   * before it starts.
   */
  dayShift: number;
  /** Same, for the end of the range: an evening that crosses midnight ends on the following day even when it started on this one. */
  endDayShift: number;
}

/**
 * `range`, written in `fromZone` on `dayOfWeek`, as it reads on
 * `toZone`'s clock. Identity when the two zones agree, so a
 * single-timezone account never sees a conversion at all.
 *
 * `at` picks the moment whose offsets are used, and defaults to the
 * upcoming `dayOfWeek` — the week the owner is actually editing. Callers
 * never pass it; tests do, because "the next Wednesday" is a different
 * offset in July than in January and an assertion that drifts with the
 * calendar is worse than no assertion.
 */
export function convertRange(
  range: { startTime: string; endTime: string },
  dayOfWeek: number,
  fromZone: string | null,
  toZone: string | null,
  on?: Date,
): ConvertedRange {
  const at = on ?? nextOccurrenceOf(dayOfWeek);
  const delta = zoneOffsetMinutes(toZone, at) - zoneOffsetMinutes(fromZone, at);
  const start = toMinutes(range.startTime) + delta;
  const end = toMinutes(range.endTime) + delta;
  return {
    startTime: fromMinutes(start),
    endTime: fromMinutes(end),
    dayShift: Math.floor(start / MINUTES_PER_DAY),
    endDayShift: Math.floor(end / MINUTES_PER_DAY),
  };
}

/**
 * Whether two wall-clock ranges *on the same day and clock* overlap.
 *
 * Touching is not overlapping here, unlike the within-a-day rule the
 * editor and the API both enforce: 09:00-12:00 and 12:00-17:00 at one
 * shop is a schedule split for no reason, but finishing at Soho exactly
 * as Valencia opens is only a clash if you also have to travel, which
 * this can't know.
 */
export function rangesOverlap(
  a: { startTime: string; endTime: string },
  b: { startTime: string; endTime: string },
): boolean {
  return (
    toMinutes(a.startTime) < toMinutes(b.endTime) && toMinutes(b.startTime) < toMinutes(a.endTime)
  );
}
