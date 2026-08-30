import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { ArrivedDot } from "@/components/calendar/ArrivedDot";
import {
  listBookingsPaged,
  updateBooking,
  getBookingReviews,
  type Booking,
  type BookingReview,
} from "@/lib/bookings-api";
import { BOOKING_STATUS_BAR, BOOKING_STATUS_TONE } from "@/lib/booking-status";
import { formatListDateHeader, formatTimeLabel, startOfDay } from "@/lib/calendar-dates";
import { invalidateVisitCaches } from "@/lib/visit-cache";

type Tab = "upcoming" | "past";
type OpenMode = "detail" | "reschedule" | "cancel";

interface AppointmentListViewProps {
  accessToken: string;
  /** Empty string means "the caller's own location" (same fallback bookings.service.ts's resolveLocationId uses server-side). */
  locationId: string;
  onOpenBooking: (booking: Booking, mode: OpenMode) => void;
}

const EMPTY_BOOKINGS: Booking[] = [];
const EMPTY_REVIEWS: BookingReview[] = [];
const PAGE_SIZE_OPTIONS = [10, 20, 50];

/**
 * T-List — the 4th Calendar view alongside Day/Week/Month. Unlike those
 * three (a date-range grid), this is a paged Upcoming/Past appointment log
 * covering every status including cancelled/no_show — see
 * bookings.service.ts's listBookingsPaged comment for the upcoming/past
 * split (endAt vs now).
 */
export function AppointmentListView({
  accessToken,
  locationId,
  onOpenBooking,
}: AppointmentListViewProps) {
  const [tab, setTab] = useState<Tab>("upcoming");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Reconciles a still-"confirmed"/"walk_in" appointment once its time has
  // passed — see the isPast branch below, which offers this instead of
  // Reschedule/Cancel (neither makes sense once the slot is behind you).
  const markStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "completed" | "no_show" }) =>
      updateBooking(accessToken, id, { status }),
    onSuccess: () => {
      void invalidateVisitCaches(queryClient);
    },
  });

  // Any of these changing invalidates whatever page we were on.
  useEffect(() => {
    setPage(1);
  }, [tab, pageSize, locationId]);

  const query = useQuery({
    queryKey: ["bookings-list", locationId, tab, page, pageSize],
    queryFn: () =>
      listBookingsPaged(accessToken, { tab, page, pageSize, locationId: locationId || undefined }),
    enabled: !!accessToken,
    placeholderData: keepPreviousData,
  });

  const bookings = query.data?.bookings ?? EMPTY_BOOKINGS;

  // Reviews only ever exist for past appointments (a customer can't review
  // a visit that hasn't happened), so this only runs on the Past tab —
  // fetched in one batch for whatever page is on screen rather than
  // per-row, since a row's detail panel stays mounted (just collapsed)
  // and would otherwise mean a hook-per-row problem inside the .map below.
  const bookingIdsKey = useMemo(() => bookings.map((b) => b.id).join(","), [bookings]);
  const reviewsQuery = useQuery({
    queryKey: ["bookings-reviews", bookingIdsKey],
    queryFn: () =>
      getBookingReviews(
        accessToken,
        bookings.map((b) => b.id),
      ),
    enabled: !!accessToken && tab === "past" && bookings.length > 0,
  });
  const reviewsByBookingId = useMemo(() => {
    const map = new Map<string, BookingReview>();
    for (const review of reviewsQuery.data?.reviews ?? EMPTY_REVIEWS)
      map.set(review.bookingId, review);
    return map;
  }, [reviewsQuery.data]);

  const totalCount = query.data?.totalCount ?? 0;
  const upcomingCount = query.data?.upcomingCount ?? 0;
  const pastCount = query.data?.pastCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);

  const groups = useMemo(() => {
    const map = new Map<string, { date: Date; bookings: Booking[] }>();
    for (const booking of bookings) {
      const day = startOfDay(new Date(booking.startAt));
      const key = day.toDateString();
      const existing = map.get(key);
      if (existing) existing.bookings.push(booking);
      else map.set(key, { date: day, bookings: [booking] });
    }
    return Array.from(map.values());
  }, [bookings]);

  function handleTabChange(next: Tab) {
    setTab(next);
    setExpandedId(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-tn-border-soft">
        <div className="flex items-center gap-6">
          {(
            [
              ["upcoming", "Upcoming", upcomingCount],
              ["past", "Past", pastCount],
            ] as [Tab, string, number][]
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              onClick={() => handleTabChange(value)}
              className={`flex cursor-pointer items-baseline gap-1.5 border-none border-b-2 bg-transparent pb-3 font-sans ${
                tab === value ? "border-tn-ink" : "border-transparent"
              }`}
            >
              <span
                className={`text-[15px] ${tab === value ? "font-semibold text-tn-ink" : "font-medium text-tn-muted-5"}`}
              >
                {label}
              </span>
              <span className="text-[13px] text-tn-muted-5">{count}</span>
            </button>
          ))}
        </div>
        {totalCount > 0 && (
          <p className="m-0 pb-3 font-sans text-[13px] text-tn-muted-5">
            Showing{" "}
            <span className="font-semibold text-tn-ink-soft">
              {rangeStart}–{rangeEnd}
            </span>{" "}
            of <span className="font-semibold text-tn-ink-soft">{totalCount}</span> appointments
          </p>
        )}
      </div>

      {query.isError && (
        <p className="m-0 font-sans text-sm text-tn-danger">
          Couldn&rsquo;t load appointments right now (
          {query.error instanceof Error ? query.error.message : "unknown error"}) — refresh to try
          again.
        </p>
      )}

      {!query.isError && !query.isPending && bookings.length === 0 && (
        <p className="m-0 py-6 text-center font-sans text-sm text-tn-muted-5">
          No {tab} appointments.
        </p>
      )}

      <div className="flex flex-col gap-5">
        {groups.map((group) => (
          <div key={group.date.toDateString()} className="flex flex-col gap-2">
            <p className="m-0 font-sans text-[11px] font-semibold tracking-wide text-tn-muted-5">
              {formatListDateHeader(group.date)}
            </p>
            <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border">
              {group.bookings.map((booking, i) => {
                const status = BOOKING_STATUS_TONE[booking.status];
                const expanded = expandedId === booking.id;
                const canManage =
                  booking.status !== "cancelled" &&
                  booking.status !== "completed" &&
                  booking.status !== "no_show";
                const start = new Date(booking.startAt);
                const end = new Date(booking.endAt);
                // Still "confirmed"/"walk_in" but the slot's already behind us —
                // needs reconciling (did the client show up or not), not
                // rescheduling/cancelling into a slot that's already passed.
                const isPast = end.getTime() < Date.now();
                return (
                  <div
                    key={booking.id}
                    className={
                      i < group.bookings.length - 1 ? "border-b border-tn-border-soft" : ""
                    }
                  >
                    <div className="flex items-stretch">
                      <div className={`w-[3px] flex-none ${BOOKING_STATUS_BAR[booking.status]}`} />
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : booking.id)}
                        className="flex flex-1 cursor-pointer items-center gap-4 px-[18px] py-3.5 text-left"
                      >
                        <span className="w-[110px] flex-none font-sans text-[13px] font-semibold text-tn-ink-soft">
                          {formatTimeLabel(start)} – {formatTimeLabel(end)}
                        </span>
                        <div className="h-9 w-9 flex-none rounded-full bg-[oklch(88%_0.02_40)]" />
                        <div className="min-w-0 flex-1">
                          <p className="m-0 truncate font-sans text-[13px] font-semibold text-tn-ink">
                            <ArrivedDot checkedInAt={booking.checkedInAt} />
                            {booking.customerName}
                            <span className="font-normal text-tn-muted-5">
                              {" "}
                              · {booking.serviceName}
                            </span>
                          </p>
                          <p className="m-0 mt-0.5 truncate font-sans text-xs text-tn-muted-5">
                            with {booking.staffName}
                          </p>
                        </div>
                        <StatusPill tone={status.tone}>{status.label}</StatusPill>
                        <span
                          className={`font-sans text-xs text-tn-faint-2 transition-transform ${expanded ? "rotate-180" : ""}`}
                          aria-hidden
                        >
                          ›
                        </span>
                      </button>
                    </div>

                    {/* Grid-rows trick for an animatable auto-height collapse — the
                        content stays mounted (so it can't just fade/pop in), and
                        the 0fr/1fr row is what actually slides it open, same
                        "keyframes/easing in one place" spirit as CalendarPage's
                        Day/Week/Month transitions. */}
                    <div
                      className="grid overflow-hidden"
                      style={{
                        gridTemplateRows: expanded ? "1fr" : "0fr",
                        transition: "grid-template-rows 260ms cubic-bezier(0.22, 1, 0.36, 1)",
                      }}
                      aria-hidden={!expanded}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <div className="flex flex-col gap-3 border-t border-tn-border-soft bg-tn-detail-bg px-[18px] py-4">
                          <div className="grid grid-cols-3 gap-x-8 gap-y-3">
                            <div>
                              <p className="m-0 font-sans text-[11px] font-semibold tracking-wide text-tn-muted-5">
                                CLIENT
                              </p>
                              <p className="m-0 mt-1 font-sans text-[13px] font-semibold text-tn-ink">
                                {booking.customerName}
                              </p>
                              {(booking.customerEmail || booking.customerPhone) && (
                                <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">
                                  {booking.customerEmail ?? booking.customerPhone}
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="m-0 font-sans text-[11px] font-semibold tracking-wide text-tn-muted-5">
                                SERVICE &amp; BARBER
                              </p>
                              <p className="m-0 mt-1 font-sans text-[13px] font-semibold text-tn-ink">
                                {booking.serviceName}
                              </p>
                              <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">
                                with {booking.staffName} · {booking.durationMinutes} min
                              </p>
                            </div>
                            <div>
                              <p className="m-0 font-sans text-[11px] font-semibold tracking-wide text-tn-muted-5">
                                PRICE
                              </p>
                              <p
                                className={`m-0 mt-1 font-sans text-[13px] font-semibold ${
                                  booking.priceCents != null ? "text-tn-ink" : "text-tn-faint-2"
                                }`}
                              >
                                {booking.priceCents != null
                                  ? `$${(booking.priceCents / 100).toFixed(2)}`
                                  : "Not set"}
                              </p>
                            </div>
                          </div>

                          <div>
                            <p className="m-0 font-sans text-[11px] font-semibold tracking-wide text-tn-muted-5">
                              NOTES
                            </p>
                            <p
                              className={`m-0 mt-1 font-sans text-[13px] ${
                                booking.notes ? "text-tn-ink-soft" : "text-tn-faint-2"
                              }`}
                            >
                              {booking.notes || "No notes"}
                            </p>
                          </div>

                          {isPast &&
                            (() => {
                              const review = reviewsByBookingId.get(booking.id);
                              return (
                                <div>
                                  <p className="m-0 font-sans text-[11px] font-semibold tracking-wide text-tn-muted-5">
                                    CUSTOMER REVIEW
                                  </p>
                                  {reviewsQuery.isPending ? (
                                    <p className="m-0 mt-1 font-sans text-[13px] text-tn-faint-2">
                                      Loading review…
                                    </p>
                                  ) : review ? (
                                    <div className="mt-1 flex flex-col gap-1">
                                      <span
                                        aria-label={`${review.rating} out of 5 stars`}
                                        className="font-sans text-[13px] text-tn-gold"
                                      >
                                        {"★".repeat(review.rating)}
                                        <span className="text-tn-border-soft">
                                          {"★".repeat(Math.max(0, 5 - review.rating))}
                                        </span>
                                      </span>
                                      <p
                                        className={`m-0 font-sans text-[13px] ${
                                          review.comment ? "text-tn-ink-soft" : "text-tn-faint-2"
                                        }`}
                                      >
                                        {review.comment || "No written comment"}
                                      </p>
                                    </div>
                                  ) : (
                                    <p className="m-0 mt-1 font-sans text-[13px] text-tn-faint-2">
                                      No review yet
                                    </p>
                                  )}
                                </div>
                              );
                            })()}

                          {canManage && (
                            <div className="flex gap-2.5 border-t border-tn-border-soft pt-3">
                              {/* !bg-* pins each button to its own solid background (both
                                rest and hover states) — "secondary"/"danger-outline" are
                                bg-transparent/translucent by default, so they'd otherwise
                                pick up whatever backdrop sits behind them (now
                                bg-tn-detail-bg instead of the page's default). Sized to
                                content (no flex-1) and left-aligned, not stretched across
                                the row. */}
                              {isPast ? (
                                <>
                                  <Button
                                    variant="secondary"
                                    className="!bg-tn-surface hover:!bg-tn-page"
                                    disabled={markStatusMutation.isPending}
                                    onClick={() =>
                                      markStatusMutation.mutate({
                                        id: booking.id,
                                        status: "completed",
                                      })
                                    }
                                  >
                                    Mark completed
                                  </Button>
                                  {/* Same rule as AppointmentModal: an arrival and a
                                      no-show can't both be true of one visit. */}
                                  {!booking.checkedInAt && (
                                    <Button
                                      variant="danger-outline"
                                      className="!bg-tn-danger-bg hover:!opacity-80"
                                      disabled={markStatusMutation.isPending}
                                      onClick={() =>
                                        markStatusMutation.mutate({
                                          id: booking.id,
                                          status: "no_show",
                                        })
                                      }
                                    >
                                      Mark no-show
                                    </Button>
                                  )}
                                  <Button
                                    variant="secondary"
                                    className="!bg-tn-surface hover:!bg-tn-page"
                                    disabled={!booking.customerEmail}
                                    onClick={() => {
                                      if (booking.customerEmail) {
                                        window.location.href = `mailto:${booking.customerEmail}`;
                                      }
                                    }}
                                  >
                                    Message client
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    variant="secondary"
                                    className="!bg-tn-surface hover:!bg-tn-page"
                                    onClick={() => onOpenBooking(booking, "reschedule")}
                                  >
                                    Reschedule
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    className="!bg-tn-surface hover:!bg-tn-page"
                                    disabled={!booking.customerEmail}
                                    onClick={() => {
                                      if (booking.customerEmail) {
                                        window.location.href = `mailto:${booking.customerEmail}`;
                                      }
                                    }}
                                  >
                                    Message client
                                  </Button>
                                  <Button
                                    variant="danger-outline"
                                    className="!bg-tn-danger-bg hover:!opacity-80"
                                    onClick={() => onOpenBooking(booking, "cancel")}
                                  >
                                    Cancel appointment
                                  </Button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {totalCount > pageSize && (
        <div className="flex items-center justify-between border-t border-tn-border-soft pt-4">
          <label className="flex items-center gap-1.5 font-sans text-[13px] text-tn-muted-5">
            Rows per page
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="cursor-pointer border-none bg-transparent font-sans text-[13px] font-semibold text-tn-ink-soft"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              aria-label="Previous page"
              className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-lg border border-tn-input-border text-tn-muted-4 hover:bg-tn-page disabled:cursor-not-allowed disabled:opacity-40"
            >
              ‹
            </button>
            {(() => {
              // A wall of 13+ page buttons (e.g. 248 appointments at 20/page)
              // doesn't fit — window down to page 1, the current page ± 1,
              // and the last page, with an ellipsis filling any gap.
              const keep = Array.from(
                new Set(
                  [1, page - 1, page, page + 1, totalPages].filter(
                    (n) => n >= 1 && n <= totalPages,
                  ),
                ),
              ).sort((a, b) => a - b);
              const nodes: ReactNode[] = [];
              keep.forEach((n, i) => {
                if (i > 0 && n - keep[i - 1]! > 1) {
                  nodes.push(
                    <span key={`gap-${n}`} className="px-0.5 font-sans text-xs text-tn-faint-2">
                      …
                    </span>,
                  );
                }
                nodes.push(
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={`flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-lg font-sans text-xs font-semibold ${
                      n === page
                        ? "bg-tn-dark text-tn-on-dark"
                        : "border border-tn-input-border text-tn-muted-4 hover:bg-tn-page"
                    }`}
                  >
                    {n}
                  </button>,
                );
              });
              return nodes;
            })()}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              aria-label="Next page"
              className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-lg border border-tn-input-border text-tn-muted-4 hover:bg-tn-page disabled:cursor-not-allowed disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AppointmentListView;
