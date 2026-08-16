import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { Field, formInputClass, formSelectClass } from "@/components/ui/FormField";
import {
  cancelBooking,
  updateBooking,
  type Booking,
  type BookingsStaffMember,
} from "@/lib/bookings-api";
import { formatDateTimeLabel } from "@/lib/calendar-dates";

interface AppointmentModalProps {
  open: boolean;
  onClose: () => void;
  booking: Booking | null;
  staff: BookingsStaffMember[];
  accessToken: string;
}

type Mode = "detail" | "reschedule" | "cancel";

const STATUS_TONE: Record<
  Booking["status"],
  { tone: "success" | "gold" | "blue" | "neutral"; label: string }
> = {
  confirmed: { tone: "success", label: "Confirmed" },
  walk_in: { tone: "gold", label: "Walk-in" },
  completed: { tone: "blue", label: "Completed" },
  cancelled: { tone: "neutral", label: "Cancelled" },
};

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
 * query; "Message"/"Check In"/SMS-notify stay decorative — no
 * messaging/check-in backend exists yet.
 */
export function AppointmentModal({
  open,
  onClose,
  booking,
  staff,
  accessToken,
}: AppointmentModalProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("detail");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newStaffId, setNewStaffId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !booking) return;
    const start = new Date(booking.startAt);
    setNewDate(toDateInputValue(start));
    setNewTime(toTimeInputValue(start));
    setNewStaffId(booking.staffUserId);
    setMode("detail");
    setError(null);
  }, [open, booking]);

  function handleClose() {
    onClose();
    setMode("detail");
    setError(null);
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
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
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
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      handleClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Couldn't cancel — try again."),
  });

  if (!booking) return null;

  const start = new Date(booking.startAt);
  const status = STATUS_TONE[booking.status];

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
              <StatusPill tone={status.tone}>{status.label}</StatusPill>
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

            {booking.status !== "cancelled" && booking.status !== "completed" && (
              <>
                <div className="flex gap-2.5">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setMode("reschedule")}
                  >
                    Reschedule
                  </Button>
                  <Button variant="secondary" className="flex-1" disabled>
                    Message
                  </Button>
                  <Button className="flex-1" disabled>
                    Check In
                  </Button>
                </div>
                <button
                  type="button"
                  onClick={() => setMode("cancel")}
                  className="cursor-pointer border-none bg-transparent text-center font-sans text-xs font-medium text-tn-danger"
                >
                  Cancel appointment
                </button>
              </>
            )}
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
                <input
                  type="time"
                  className={formInputClass}
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                />
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
