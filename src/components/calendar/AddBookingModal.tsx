import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, formInputClass, formSelectClass } from "@/components/ui/FormField";
import { DatePicker } from "@/components/ui/DatePicker";
import { TimePicker } from "@/components/ui/TimePicker";
import { PhoneInput, isPhoneValid } from "@/components/ui/PhoneInput";
import { createBooking, type BookingsStaffMember } from "@/lib/bookings-api";
import { ApiError } from "@/lib/http";
import { listServices } from "@/lib/services-api";
import { zonedTimeToUtc } from "@/lib/calendar-dates";

interface AddBookingModalProps {
  open: boolean;
  onClose: () => void;
  staff: BookingsStaffMember[];
  accessToken: string;
  /** Prefilled from whichever slot/day the user clicked — "+ Add Booking" passes just the currently viewed date. */
  defaultDate: Date;
  defaultStaffId?: string;
  defaultTime?: string;
  /**
   * IANA zone the Date/Time step's wall-clock values (and any prefilled
   * `defaultTime` from a Day view slot click) should be read in — matches
   * CalendarPage's own timezone picker so a booking made for "2:00 PM"
   * lands at 2:00 PM in the zone the grid is actually showing, not 2:00 PM
   * in whatever zone the browser happens to be in. Omitted = old
   * browser-local behavior (e.g. any other future caller of this modal).
   */
  timezone?: string;
  /**
   * Which shop this booking is for. The service menu is account-level now
   * (services + location_services), so without this the picker would offer
   * treatments this location doesn't do — and quote the catalogue price
   * rather than the one this site charges.
   */
  /** Which shop the appointment is at. Required: the server no longer infers it from the caller — see bookings-api.ts. */
  locationId: string;
}

function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toTimeInputValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/**
 * T7's "+ Add Booking" form: one screen, four labelled sections
 * (customer, service, staff & time, notes).
 *
 * It used to be a wizard. Every step was a handful of fields with a Next
 * button under it, which meant four clicks and three screens to enter what
 * fits comfortably in one — and the last step existed largely to show a
 * summary of what you had already typed but could no longer see. As a
 * side sheet the whole form has full viewport height to sit in, so the
 * reason to slice it up is gone.
 *
 * Every field maps straight onto bookings-api.ts's createBooking payload.
 */
export function AddBookingModal({
  open,
  onClose,
  staff,
  accessToken,
  defaultDate,
  defaultStaffId,
  defaultTime,
  timezone,
  locationId,
}: AddBookingModalProps) {
  const queryClient = useQueryClient();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [staffUserId, setStaffUserId] = useState(defaultStaffId ?? staff[0]?.id ?? "");
  const [dateValue, setDateValue] = useState(toDateInputValue(defaultDate));
  const [timeValue, setTimeValue] = useState(defaultTime ?? "09:00");
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  // The server's own words for why this slot is out of hours. Held apart
  // from formError because this one is answerable: the owner can go
  // ahead anyway, which a plain red line gives them no way to do.
  const [outsideShiftWarning, setOutsideShiftWarning] = useState<string | null>(null);

  // Real, account-configured services (T9's menu) rather than free text —
  // same source Services page itself reads from, so what's pickable here
  // always matches what actually exists. Only fetched while the modal's
  // open, matching AddMemberWizard.tsx's locations/roles queries.
  const servicesQuery = useQuery({
    queryKey: ["services", locationId],
    queryFn: () => listServices(accessToken, locationId),
    enabled: open,
  });
  const services = servicesQuery.data?.services.filter((s) => s.isEnabled) ?? [];

  const selectedServices = services.filter((s) => selectedServiceIds.has(s.id));
  // A booking can bundle more than one service (e.g. "Haircut" + "Beard
  // Trim" back to back) — bookings-api.ts's createBooking still only takes
  // one serviceName/durationMinutes/priceCents, so multiple picks get
  // joined/summed into that single set of fields rather than needing a
  // backend change for a multi-service booking model.
  const combinedServiceName = selectedServices.map((s) => s.name).join(", ");
  const combinedDurationMinutes = selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);
  const combinedPriceCents = selectedServices.reduce((sum, s) => sum + s.priceCents, 0);

  // Re-sync whenever the modal is reopened for a different slot/day.
  useEffect(() => {
    if (!open) return;
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setSelectedServiceIds(new Set());
    setStaffUserId(defaultStaffId ?? staff[0]?.id ?? "");
    setDateValue(toDateInputValue(defaultDate));
    setTimeValue(defaultTime ?? toTimeInputValue(defaultDate));
    setIsWalkIn(false);
    setNotes("");
    setFormError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultDate, defaultStaffId, defaultTime]);

  function toggleService(id: string) {
    setSelectedServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const mutation = useMutation({
    mutationFn: (allowOutsideShift?: boolean) => {
      const [year, month, day] = dateValue.split("-").map(Number);
      const [hour, minute] = timeValue.split(":").map(Number);
      const startAt =
        timezone && year !== undefined && month !== undefined && day !== undefined
          ? zonedTimeToUtc(year, month - 1, day, hour ?? 0, minute ?? 0, timezone)
          : new Date(`${dateValue}T${timeValue}:00`);
      return createBooking(accessToken, {
        locationId,
        staffUserId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        serviceName: combinedServiceName,
        durationMinutes: combinedDurationMinutes,
        priceCents: combinedPriceCents > 0 ? combinedPriceCents : undefined,
        startAt: startAt.toISOString(),
        status: isWalkIn ? "walk_in" : "confirmed",
        notes: notes.trim() || undefined,
        allowOutsideShift,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      onClose();
    },
    onError: (err) => {
      // The server decides whether a slot is out of hours and flags it with
      // a code, so this doesn't re-derive the schedule client-side and risk
      // the two disagreeing. Anything else is a plain failure.
      const code =
        err instanceof ApiError && err.body && typeof err.body === "object"
          ? (err.body as { code?: unknown }).code
          : undefined;
      if (code === "OUTSIDE_SHIFT") {
        setOutsideShiftWarning(err.message);
        return;
      }
      setFormError(err instanceof Error ? err.message : "Couldn't create the booking — try again.");
    },
  });

  /**
   * One pass over everything, in the order the fields appear — so the
   * message always points at the first thing that needs attention rather
   * than whichever check happens to be written first.
   */
  function handleSubmit() {
    if (!customerName.trim()) {
      setFormError("Add the customer's name.");
      return;
    }
    if (!isPhoneValid(customerPhone)) {
      setFormError("That phone number doesn't look right for the selected country.");
      return;
    }
    if (selectedServiceIds.size === 0) {
      setFormError("Pick at least one service.");
      return;
    }
    if (!staffUserId || !dateValue || !timeValue) {
      setFormError("Pick a staff member, date, and time.");
      return;
    }

    setFormError(null);
    setOutsideShiftWarning(null);
    mutation.mutate(undefined);
  }

  return (
    // A side sheet, same as the other create-a-record forms — and what
    // makes one screen viable here: full viewport height fits every
    // section without a wizard, and the calendar grid stays visible
    // behind, so the slot being booked into is still on screen.
    <Modal open={open} onClose={onClose} width={520} variant="sheet">
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

      <div className="flex flex-col gap-5 px-6 pb-6 pt-4">
        <div className="flex flex-col gap-[18px]">
          <Field label="CUSTOMER NAME">
            <input
              className={formInputClass}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Jordan Rivera"
            />
          </Field>

          <Field label="PHONE (OPTIONAL)">
            <PhoneInput value={customerPhone} onChange={setCustomerPhone} />
          </Field>

          <Field label="EMAIL (OPTIONAL)">
            <input
              type="email"
              className={formInputClass}
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="jordan@example.com"
            />
          </Field>
        </div>

        <div className="flex flex-col gap-3 border-t border-tn-border-soft pt-5">
          <p className="m-0 font-sans text-xs font-semibold tracking-[0.04em] text-tn-muted-5">
            SERVICE (SELECT ONE OR MORE)
          </p>

          {servicesQuery.isPending && (
            <p className="m-0 font-sans text-[13px] text-tn-muted-5">Loading services…</p>
          )}
          {!servicesQuery.isPending && services.length === 0 && (
            <p className="m-0 font-sans text-[13px] text-tn-muted-5">
              No services set up yet — add one on the Services page first.
            </p>
          )}

          {services.length > 0 && (
            <div className="flex max-h-72 flex-col overflow-y-auto rounded-xl border border-tn-border">
              <div className="grid grid-cols-[2fr_1fr_1fr_0.8fr] bg-tn-table-head px-4 py-2.5 font-sans text-xs font-semibold text-tn-muted-5">
                <span>SERVICE</span>
                <span>PRICE</span>
                <span>DURATION</span>
                <span>SELECT</span>
              </div>
              {services.map((s, i) => (
                <label
                  key={s.id}
                  className={`grid grid-cols-[2fr_1fr_1fr_0.8fr] items-center px-4 py-3 ${
                    i < services.length - 1 ? "border-b border-tn-border-soft" : ""
                  }`}
                >
                  <span className="font-sans text-[13px] text-tn-ink">
                    {s.name}
                    {s.categoryName && (
                      <span className="ml-1.5 font-sans text-xs text-tn-muted-5">
                        {s.categoryName}
                      </span>
                    )}
                  </span>
                  <span className="font-sans text-[13px] text-tn-muted-3">
                    ${(s.priceCents / 100).toFixed(2)}
                  </span>
                  <span className="font-sans text-[13px] text-tn-muted-3">
                    {s.durationMinutes} min
                  </span>
                  <input
                    type="checkbox"
                    checked={selectedServiceIds.has(s.id)}
                    onChange={() => toggleService(s.id)}
                    className="accent-tn-gold"
                  />
                </label>
              ))}
            </div>
          )}

          {selectedServices.length > 0 && (
            <p className="m-0 font-sans text-xs text-tn-muted-5">
              {selectedServices.length} selected · {combinedDurationMinutes} min total · $
              {(combinedPriceCents / 100).toFixed(2)}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-[18px] border-t border-tn-border-soft pt-5">
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

          <div className="grid grid-cols-2 gap-4">
            <Field label="DATE">
              <DatePicker value={dateValue} onChange={setDateValue} label="Date" />
            </Field>

            <Field label="TIME">
              <TimePicker value={timeValue} onChange={setTimeValue} label="Time" />
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
        </div>

        {/* The wizard's last step opened with a card summarising what you
            had typed, because by then you could no longer see it. On one
            screen everything it repeated is a few centimetres above, so
            only the field it wrapped survives. */}
        <div className="border-t border-tn-border-soft pt-5">
          <Field label="NOTES (OPTIONAL)">
            <input
              className={formInputClass}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the barber should know"
            />
          </Field>
        </div>

        {formError && <p className="m-0 font-sans text-xs text-tn-danger">{formError}</p>}

        {outsideShiftWarning && (
          <div className="flex flex-col gap-2 rounded-xl border border-tn-gold bg-tn-gold-bg p-3">
            <p className="m-0 font-sans text-xs text-tn-ink-soft">{outsideShiftWarning}</p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setOutsideShiftWarning(null)}
                disabled={mutation.isPending}
              >
                Pick another time
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setOutsideShiftWarning(null);
                  mutation.mutate(true);
                }}
                disabled={mutation.isPending}
              >
                Book anyway
              </Button>
            </div>
          </div>
        )}

        <div className="flex gap-2.5 border-t border-tn-border-soft pt-3">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={handleSubmit}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Booking…" : "Add Booking"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default AddBookingModal;
