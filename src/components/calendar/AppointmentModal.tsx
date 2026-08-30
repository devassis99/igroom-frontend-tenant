import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { Field, formInputClass, formSelectClass } from "@/components/ui/FormField";
import { TimePicker } from "@/components/ui/TimePicker";
import {
  cancelBooking,
  setBookingCheckedIn,
  updateBooking,
  getBookingReviews,
  type Booking,
  type BookingsStaffMember,
} from "@/lib/bookings-api";
import { BOOKING_STATUS_TONE } from "@/lib/booking-status";
import { formatDateTimeLabel } from "@/lib/calendar-dates";
import { invalidateVisitCaches } from "@/lib/visit-cache";

type Mode = "detail" | "reschedule" | "cancel";

interface AppointmentModalProps {
  open: boolean;
  onClose: () => void;
  booking: Booking | null;
  staff: BookingsStaffMember[];
  accessToken: string;
  /** Which of the three states to open into — defaults to "detail". The List view's inline Reschedule/Cancel row actions open straight into those modes instead of an extra click through the detail screen. */
  initialMode?: Mode;
}

function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toTimeInputValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/**
 * One modal covering all three of the mockup's appointment-detail frames
 * (T7c detail, T7d reschedule, T7e cancel) — they're the same appointment
 * moving through states rather than three separate screens. Reschedule
 * uses plain date/time inputs rather than the mockup's fixed slot grid
 * (T7d) since a real slot grid would need a live per-staff availability
 * query. "Check In" is real (POST /bookings/:id/check-in); "Message"
 * opens a mailto: and SMS-notify stays decorative — no messaging backend
 * exists yet.
 */
export function AppointmentModal({
  open,
  onClose,
  booking: selected,
  staff,
  accessToken,
  initialMode,
}: AppointmentModalProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("detail");
  /**
   * The version this modal has changed itself, if it has.
   *
   * `booking` arrives as a snapshot the parent took when the row was
   * clicked. Invalidating the bookings query refreshes the list behind
   * the modal but not that captured object, so before this existed,
   * checking someone in updated the calendar underneath while the open
   * modal still showed "Check In" — the one action here that leaves the
   * modal open was also the one that made the staleness visible.
   *
   * Kept here rather than fixed by deriving the selection from the query:
   * the List view opens bookings from a *different* query (a paged one
   * covering dates the calendar grid never loaded), so there is no single
   * list to look them up in.
   */
  const [changed, setChanged] = useState<Booking | null>(null);
  const booking = changed ?? selected;
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newStaffId, setNewStaffId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !selected) return;
    const start = new Date(selected.startAt);
    setNewDate(toDateInputValue(start));
    setNewTime(toTimeInputValue(start));
    setNewStaffId(selected.staffUserId);
    setMode(initialMode ?? "detail");
    setError(null);
    setChanged(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialMode is read once per open, not tracked live
  }, [open, selected]);

  function handleClose() {
    onClose();
    setMode("detail");
    setError(null);
    setChanged(null);
  }

  const rescheduleMutation = useMutation({
    mutationFn: () => {
      if (!booking) return Promise.reject(new Error("No booking selected"));
      const startAt = new Date(`${newDate}T${newTime}:00`);
      return updateBooking(accessToken, booking.id, {
        startAt: startAt.toISOString(),
        staffUserId: newStaffId !== booking.staffUserId ? newStaffId : undefined,
      });
    },
    onSuccess: () => {
      void invalidateVisitCaches(queryClient);
      handleClose();
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Couldn't reschedule — try again."),
  });

  const cancelMutation = useMutation({
    mutationFn: () => {
      if (!booking) return Promise.reject(new Error("No booking selected"));
      return cancelBooking(accessToken, booking.id);
    },
    onSuccess: () => {
      void invalidateVisitCaches(queryClient);
      handleClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Couldn't cancel — try again."),
  });

  // Reconciles a still-"confirmed"/"walk_in" appointment once its time has
  // passed — offered instead of Reschedule/Cancel below, same reasoning as
  // AppointmentListView.tsx's Past tab.
  const markStatusMutation = useMutation({
    mutationFn: (nextStatus: "completed" | "no_show") => {
      if (!booking) return Promise.reject(new Error("No booking selected"));
      return updateBooking(accessToken, booking.id, { status: nextStatus });
    },
    onSuccess: () => {
      // The queue too: if this appointment was a seated walk-in, the
      // backend has just closed its waitlist row, and if it was a
      // checked-in appointment it has dropped off the board.
      void invalidateVisitCaches(queryClient);
      handleClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Couldn't update — try again."),
  });

  /**
   * Arrival. Not a status change — the appointment stays "confirmed"
   * while the client sits in the shop, which is what keeps them ringable
   * at the register.
   *
   * The modal stays open afterwards rather than closing: checking
   * somebody in is not the end of dealing with them, and the desk often
   * wants to glance at the notes or reschedule in the same breath.
   */
  const checkInMutation = useMutation({
    mutationFn: (checkedIn: boolean) => {
      if (!booking) return Promise.reject(new Error("No booking selected"));
      return setBookingCheckedIn(accessToken, booking.id, checkedIn);
    },
    onSuccess: (updated) => {
      setChanged(updated);
      // Checking in puts them on the waitlist board, so that reads again too.
      void invalidateVisitCaches(queryClient);
      setError(null);
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Couldn't check them in — try again."),
  });

  // Only fetched once the appointment's actually past — see
  // AppointmentListView.tsx's identical reasoning (a customer can't
  // review a visit that hasn't happened yet).
  const reviewQuery = useQuery({
    queryKey: ["bookings-reviews", booking?.id],
    queryFn: () => getBookingReviews(accessToken, [booking!.id]),
    enabled: !!booking && new Date(booking.endAt).getTime() < Date.now(),
  });

  if (!booking) return null;

  const start = new Date(booking.startAt);
  const end = new Date(booking.endAt);
  const status = BOOKING_STATUS_TONE[booking.status];
  const isPast = end.getTime() < Date.now();
  const checkedInAt = booking.checkedInAt ? new Date(booking.checkedInAt) : null;
  const arrivedLabel = checkedInAt
    ? checkedInAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "";
  const review = reviewQuery.data?.reviews[0];

  const titles: Record<Mode, string> = {
    detail: "Appointment",
    reschedule: "Reschedule",
    cancel: "Cancel appointment",
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <div className="flex items-center justify-between px-6 pt-6">
        <h2 className="m-0 font-sans text-[19px] font-semibold text-tn-ink">{titles[mode]}</h2>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="cursor-pointer border-none bg-transparent font-sans text-xl text-tn-muted-6"
        >
          &times;
        </button>
      </div>

      <div className="flex flex-col gap-[18px] px-6 pb-6 pt-5">
        {mode === "detail" && (
          <>
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 flex-none rounded-full bg-[oklch(88%_0.02_40)]" />
              <div className="flex-1">
                <p className="m-0 font-sans text-base font-semibold text-tn-ink">
                  {booking.customerName}
                </p>
                {booking.customerPhone && (
                  <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">
                    {booking.customerPhone}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <StatusPill tone={status.tone}>{status.label}</StatusPill>
                {/*
                  Shown next to the status rather than replacing it: the
                  appointment is still "confirmed" while they sit in the
                  shop. Two separate facts, two separate pills.
                */}
                {checkedInAt && <StatusPill tone="success">Arrived {arrivedLabel}</StatusPill>}
              </div>
            </div>

            <div className="flex flex-col overflow-hidden rounded-xl border border-tn-border">
              {(
                [
                  ["Service", booking.serviceName],
                  ["Barber", booking.staffName],
                  ["Date & time", formatDateTimeLabel(start)],
                  ["Duration", `${booking.durationMinutes} min`],
                  ...(booking.priceCents != null
                    ? ([["Price", `$${(booking.priceCents / 100).toFixed(2)}`]] as [
                        string,
                        string,
                      ][])
                    : []),
                  ...(booking.notes ? ([["Notes", booking.notes]] as [string, string][]) : []),
                ] as [string, string][]
              ).map(([label, value], i, arr) => (
                <div
                  key={label}
                  className={`flex justify-between gap-4 px-4 py-3 ${i < arr.length - 1 ? "border-b border-tn-border-soft" : ""}`}
                >
                  <span className="font-sans text-[13px] text-tn-muted-5">{label}</span>
                  <span className="text-right font-sans text-[13px] font-semibold text-tn-ink-soft">
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {isPast && (
              <div className="flex flex-col gap-1.5 rounded-xl border border-tn-border p-3.5">
                <p className="m-0 font-sans text-[11px] font-semibold tracking-wide text-tn-muted-5">
                  CUSTOMER REVIEW
                </p>
                {reviewQuery.isPending ? (
                  <p className="m-0 font-sans text-[13px] text-tn-faint-2">Loading review…</p>
                ) : review ? (
                  <>
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
                  </>
                ) : (
                  <p className="m-0 font-sans text-[13px] text-tn-faint-2">No review yet</p>
                )}
              </div>
            )}

            {booking.status !== "cancelled" &&
              booking.status !== "completed" &&
              booking.status !== "no_show" &&
              (isPast ? (
                <div className="flex gap-2.5">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    disabled={markStatusMutation.isPending}
                    onClick={() => markStatusMutation.mutate("completed")}
                  >
                    Mark completed
                  </Button>
                  {/*
                    A no-show and an arrival can't both be true of one
                    visit, so a checked-in client is offered the way back
                    instead: take the arrival off, and the no-show
                    becomes available (and honest). The API refuses the
                    contradiction either way — see updateBooking.
                  */}
                  {checkedInAt ? (
                    <Button
                      variant="secondary"
                      className="flex-1 whitespace-nowrap"
                      disabled={checkInMutation.isPending}
                      onClick={() => checkInMutation.mutate(false)}
                    >
                      Undo check-in
                    </Button>
                  ) : (
                    <Button
                      variant="danger-outline"
                      className="flex-1"
                      disabled={markStatusMutation.isPending}
                      onClick={() => markStatusMutation.mutate("no_show")}
                    >
                      Mark no-show
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    className="flex-1"
                    disabled={!booking.customerEmail}
                    onClick={() => {
                      if (booking.customerEmail)
                        window.location.href = `mailto:${booking.customerEmail}`;
                    }}
                  >
                    Message
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2.5">
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={() => setMode("reschedule")}
                    >
                      Reschedule
                    </Button>
                    <Button
                      variant="secondary"
                      className="flex-1"
                      disabled={!booking.customerEmail}
                      onClick={() => {
                        if (booking.customerEmail)
                          window.location.href = `mailto:${booking.customerEmail}`;
                      }}
                    >
                      Message
                    </Button>
                    {checkedInAt ? (
                      <Button
                        variant="secondary"
                        // nowrap rather than a narrower padding override:
                        // two padding utilities of equal specificity on
                        // one element resolve by CSS source order, which
                        // is not something to bet a layout on. With
                        // flex-1 and nowrap the button simply sizes to
                        // its label instead.
                        className="flex-1 whitespace-nowrap"
                        onClick={() => checkInMutation.mutate(false)}
                        disabled={checkInMutation.isPending}
                      >
                        Undo check-in
                      </Button>
                    ) : (
                      <Button
                        className="flex-1"
                        onClick={() => checkInMutation.mutate(true)}
                        disabled={checkInMutation.isPending}
                      >
                        {checkInMutation.isPending ? "Checking in…" : "Check In"}
                      </Button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setMode("cancel")}
                    className="cursor-pointer border-none bg-transparent text-center font-sans text-xs font-medium text-tn-danger"
                  >
                    Cancel appointment
                  </button>
                </>
              ))}
          </>
        )}

        {mode === "reschedule" && (
          <>
            <div className="flex items-center gap-3 rounded-xl bg-tn-page p-3.5">
              <div className="h-9 w-9 flex-none rounded-full bg-[oklch(88%_0.02_40)]" />
              <div>
                <p className="m-0 font-sans text-[13px] font-semibold text-tn-ink">
                  {booking.customerName} · {booking.serviceName}
                </p>
                <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">
                  Currently {formatDateTimeLabel(start)} with {booking.staffName}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="NEW DATE">
                <input
                  type="date"
                  className={formInputClass}
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </Field>
              <Field label="NEW TIME">
                <TimePicker label="New time" value={newTime} onChange={setNewTime} />
              </Field>
            </div>

            <Field label="BARBER">
              <select
                className={formSelectClass}
                value={newStaffId}
                onChange={(e) => setNewStaffId(e.target.value)}
              >
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </Field>

            <label className="flex items-center gap-2 font-sans text-[13px] text-tn-muted-1">
              <input type="checkbox" defaultChecked className="accent-tn-gold" disabled />
              Notify customer by SMS
            </label>

            {error && <p className="m-0 font-sans text-xs text-tn-danger">{error}</p>}

            <div className="flex gap-2.5 border-t border-tn-border-soft pt-3">
              <Button variant="secondary" className="flex-1" onClick={() => setMode("detail")}>
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={() => rescheduleMutation.mutate()}
                disabled={rescheduleMutation.isPending || !newDate || !newTime}
              >
                {rescheduleMutation.isPending ? "Saving…" : "Confirm New Time"}
              </Button>
            </div>
          </>
        )}

        {mode === "cancel" && (
          <>
            <div className="flex items-center gap-3 rounded-xl bg-tn-page p-3.5">
              <div className="h-9 w-9 flex-none rounded-full bg-[oklch(88%_0.02_40)]" />
              <div>
                <p className="m-0 font-sans text-[13px] font-semibold text-tn-ink">
                  {booking.customerName} · {booking.serviceName}
                </p>
                <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">
                  {formatDateTimeLabel(start)} with {booking.staffName}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 rounded-xl border border-tn-border bg-tn-page p-3.5">
              <div className="flex items-center gap-2">
                <span className="text-tn-danger" aria-hidden>
                  ⚠
                </span>
                <p className="m-0 font-sans text-[13px] font-semibold text-tn-ink">
                  This can&rsquo;t be undone
                </p>
              </div>
              <p className="m-0 font-sans text-xs text-tn-muted-4">
                The slot stays in the shop&rsquo;s history marked as cancelled.
              </p>
            </div>

            <label className="flex items-center gap-2 font-sans text-[13px] text-tn-muted-1">
              <input type="checkbox" defaultChecked className="accent-tn-gold" disabled />
              Notify customer by SMS
            </label>

            {error && <p className="m-0 font-sans text-xs text-tn-danger">{error}</p>}

            <div className="flex gap-2.5 border-t border-tn-border-soft pt-3">
              <Button variant="secondary" className="flex-1" onClick={() => setMode("detail")}>
                Keep Appointment
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? "Cancelling…" : "Cancel Appointment"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default AppointmentModal;
