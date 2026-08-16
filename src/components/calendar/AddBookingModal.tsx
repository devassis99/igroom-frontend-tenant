import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, formInputClass, formSelectClass } from "@/components/ui/FormField";
import { createBooking, type BookingsStaffMember } from "@/lib/bookings-api";

interface AddBookingModalProps {
  open: boolean;
  onClose: () => void;
  staff: BookingsStaffMember[];
  accessToken: string;
  /** Prefilled from whichever slot/day the user clicked — "+ Add Booking" passes just the currently viewed date. */
  defaultDate: Date;
  defaultStaffId?: string;
  defaultTime?: string;
}

function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toTimeInputValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

/**
 * T7's "+ Add Booking" form — new, not in the original mockup's static
 * screens (those only showed already-booked slots), but the same visual
 * language (Field/formInputClass) so it doesn't feel bolted on.
 */
export function AddBookingModal({
  open,
  onClose,
  staff,
  accessToken,
  defaultDate,
  defaultStaffId,
  defaultTime,
}: AddBookingModalProps) {
  const queryClient = useQueryClient();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [staffUserId, setStaffUserId] = useState(defaultStaffId ?? staff[0]?.id ?? "");
  const [dateValue, setDateValue] = useState(toDateInputValue(defaultDate));
  const [timeValue, setTimeValue] = useState(defaultTime ?? "09:00");
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Re-sync whenever the modal is reopened for a different slot/day.
  useEffect(() => {
    if (!open) return;
    setCustomerName("");
    setCustomerPhone("");
    setServiceName("");
    setDurationMinutes(30);
    setStaffUserId(defaultStaffId ?? staff[0]?.id ?? "");
    setDateValue(toDateInputValue(defaultDate));
    setTimeValue(defaultTime ?? toTimeInputValue(defaultDate));
    setIsWalkIn(false);
    setNotes("");
    setFormError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultDate, defaultStaffId, defaultTime]);

  const mutation = useMutation({
    mutationFn: () => {
      const startAt = new Date(`${dateValue}T${timeValue}:00`);
      return createBooking(accessToken, {
        staffUserId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        serviceName: serviceName.trim(),
        durationMinutes,
        startAt: startAt.toISOString(),
        status: isWalkIn ? "walk_in" : "confirmed",
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      onClose();
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : "Couldn't create the booking — try again.");
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!customerName.trim() || !serviceName.trim() || !staffUserId || !dateValue || !timeValue) {
      setFormError("Fill in customer, service, staff, and a date/time.");
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal open={open} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="flex items-center justify-between px-6 pt-6">
          <h2 className="m-0 font-sans text-[19px] font-semibold text-tn-ink">Add Booking</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer border-none bg-transparent font-sans text-xl text-tn-muted-6"
          >
            &times;
          </button>
        </div>

        <div className="flex flex-col gap-[18px] px-6 pb-6 pt-5">
          <Field label="CUSTOMER NAME">
            <input
              className={formInputClass}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Jordan Rivera"
            />
          </Field>

          <Field label="PHONE (OPTIONAL)">
            <input
              className={formInputClass}
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="(555) 555-0182"
            />
          </Field>

          <Field label="SERVICE">
            <input
              className={formInputClass}
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="Haircut & Beard Trim"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="STAFF">
              <select
                className={formSelectClass}
                value={staffUserId}
                onChange={(e) => setStaffUserId(e.target.value)}
              >
                {staff.length === 0 && <option value="">No staff available</option>}
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="DURATION">
              <select
                className={formSelectClass}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
              >
                {DURATION_OPTIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} min
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="DATE">
              <input
                type="date"
                className={formInputClass}
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
              />
            </Field>

            <Field label="TIME">
              <input
                type="time"
                className={formInputClass}
                value={timeValue}
                onChange={(e) => setTimeValue(e.target.value)}
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 font-sans text-[13px] text-tn-muted-1">
            <input
              type="checkbox"
              checked={isWalkIn}
              onChange={(e) => setIsWalkIn(e.target.checked)}
              className="accent-tn-gold"
            />
            Walk-in (no online booking record)
          </label>

          <Field label="NOTES (OPTIONAL)">
            <input
              className={formInputClass}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the barber should know"
            />
          </Field>

          {formError && <p className="m-0 font-sans text-xs text-tn-danger">{formError}</p>}

          <div className="flex gap-2.5 border-t border-tn-border-soft pt-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? "Booking…" : "Add Booking"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default AddBookingModal;
