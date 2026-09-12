import { useMemo } from "react";
import type { Booking } from "@/lib/bookings-api";
import { formatTimeLabel } from "@/lib/calendar-dates";
import { staffAvatarColorStrong } from "@/lib/staff-avatar-color";

/**
 * The week's shape in three numbers, and the one hour worth looking at.
 *
 * Week view answers "where is the work" well and "how much of it" badly:
 * a stacked column deliberately hides its own depth, and seven per-day
 * counts don't add themselves up. This is the other half of that trade —
 * the totals the grid can't show, and the busiest moment in the week,
 * which is the hour a manager either staffs differently or stops selling.
 */

interface BusiestSlot {
  start: Date;
  bookings: Booking[];
}

/**
 * The moment with the most bookings running at once.
 *
 * Every booking's own start is a candidate, and the count at each is how
 * many other bookings are open across it. That is O(n²) and fine: a week
 * at one shop is tens of bookings, not thousands, and the alternative (a
 * swept event list) would be harder to read for no gain anyone could
 * measure.
 *
 * Ties go to the earliest, so the answer doesn't jump around between
 * renders when two hours are equally busy.
 */
function busiestSlot(bookings: Booking[]): BusiestSlot | null {
  const live = bookings.filter((booking) => booking.status !== "cancelled");
  if (live.length === 0) return null;

  let best: BusiestSlot | null = null;
  for (const candidate of live) {
    const at = new Date(candidate.startAt).getTime();
    const overlapping = live.filter(
      (other) => new Date(other.startAt).getTime() <= at && new Date(other.endAt).getTime() > at,
    );
    if (!best || overlapping.length > best.bookings.length) {
      best = { start: new Date(candidate.startAt), bookings: overlapping };
    }
  }
  // A single appointment is not an "overlap" worth a panel of its own.
  if (!best || best.bookings.length < 2) return null;
  return best;
}

export function WeekActivityRail({
  weekLabel,
  bookings,
  staffOnRota,
  timezone,
}: {
  /** "Sep 7 – 13" — the same label the toolbar shows, so the two agree. */
  weekLabel: string;
  bookings: Booking[];
  /** Distinct staff with at least one booking this week. */
  staffOnRota: number;
  timezone: string | undefined;
}) {
  const liveCount = useMemo(
    () => bookings.filter((booking) => booking.status !== "cancelled").length,
    [bookings],
  );
  const busiest = useMemo(() => busiestSlot(bookings), [bookings]);

  return (
    <aside className="flex w-[260px] flex-none flex-col gap-5 rounded-2xl border border-tn-border bg-tn-surface p-4">
      <div className="flex flex-col gap-1.5">
        <span className="font-sans text-[10px] font-semibold tracking-[0.08em] text-tn-faint">
          ACTIVITY
        </span>
        <p className="m-0 font-sans text-[13px] leading-relaxed text-tn-ink">
          Week of {weekLabel} · {liveCount} booking{liveCount === 1 ? "" : "s"} · {staffOnRota}{" "}
          barber{staffOnRota === 1 ? "" : "s"} on rota
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="font-sans text-[10px] font-semibold tracking-[0.08em] text-tn-faint">
          BUSIEST OVERLAP
        </span>
        {busiest === null ? (
          <p className="m-0 font-sans text-[12px] leading-relaxed text-tn-muted-5">
            Nothing doubles up this week — every appointment has the shop to itself.
          </p>
        ) : (
          <div className="flex flex-col gap-2 rounded-xl border border-tn-border-soft bg-tn-page p-3">
            <span className="font-sans text-[12px] font-semibold text-tn-ink">
              {busiest.start.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })} ·{" "}
              {formatTimeLabel(busiest.start, timezone)} · {busiest.bookings.length} chairs
            </span>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {/* Barber above client rather than beside it. Side by side,
                  two 110px halves turned every real name into an
                  ellipsis — and which barber is in at the busiest hour is
                  the entire point of the panel. */}
              {busiest.bookings.map((booking) => (
                <li key={booking.id} className="flex items-start gap-2">
                  <span
                    aria-hidden
                    className="mt-1 size-2 flex-none rounded-full"
                    style={{ backgroundColor: staffAvatarColorStrong(booking.staffUserId) }}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-sans text-[11.5px] font-medium text-tn-ink-soft">
                      {booking.staffName}
                    </span>
                    <span className="truncate font-sans text-[11px] text-tn-muted-5">
                      {booking.customerName}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {/* Said out loud because the instinct on seeing three cards in
                one hour is "something is double-booked", and it usually
                isn't — three barbers is three chairs. The collision guard
                is what catches a real clash, and it would have refused
                the save. */}
            <p className="m-0 font-sans text-[10.5px] leading-relaxed text-tn-faint">
              {new Set(busiest.bookings.map((booking) => booking.staffUserId)).size ===
              busiest.bookings.length
                ? "Different staff, so not a clash — the column stacks and the count shows the rest."
                : "Some of these share a barber — worth opening the day."}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

export default WeekActivityRail;
