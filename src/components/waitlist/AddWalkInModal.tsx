import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, formInputClass, formSelectClass } from "@/components/ui/FormField";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { useAuthStore } from "@/auth/auth-store";
import { listLocationServices, listLocationStaff } from "@/lib/locations-api";
import type { WaitlistBoard } from "@/lib/waitlist-api";

interface AddWalkInModalProps {
  open: boolean;
  onClose: () => void;
  locationId: string;
  /** The live board, so the preview line quotes the real queue rather than a guess. */
  board: WaitlistBoard | undefined;
  onSubmit: (input: {
    customerName: string;
    customerPhone?: string;
    serviceId: string;
    staffUserId?: string;
    notes?: string;
  }) => void;
  pending: boolean;
  error: string | null;
}

/**
 * The "+ Add Walk-in" modal.
 *
 * Services and staff come from this location, not a hardcoded list —
 * every shop sells something different, and a dropdown offering "Hot
 * Towel Shave" at a nail studio is a form that lies. The preview line at
 * the bottom is computed from the board this page already has, so it
 * quotes the same position and wait the customer is about to be told at
 * the counter.
 */
export function AddWalkInModal({
  open,
  onClose,
  locationId,
  board,
  onSubmit,
  pending,
  error,
}: AddWalkInModalProps) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [staffUserId, setStaffUserId] = useState("");
  const [notes, setNotes] = useState("");

  const servicesQuery = useQuery({
    queryKey: ["location-services", locationId],
    queryFn: () => listLocationServices(accessToken ?? "", locationId),
    enabled: open && Boolean(accessToken && locationId),
  });
  const staffQuery = useQuery({
    queryKey: ["location-staff", locationId],
    queryFn: () => listLocationStaff(accessToken ?? "", locationId),
    enabled: open && Boolean(accessToken && locationId),
  });

  // Only what this shop actually sells online — the same filter the
  // booking screen and the customer app apply.
  const services = useMemo(
    () => (servicesQuery.data?.services ?? []).filter((s) => s.offered && s.isEnabled),
    [servicesQuery.data],
  );
  const staff = useMemo(
    () => (staffQuery.data?.staff ?? []).filter((s) => s.isActive),
    [staffQuery.data],
  );

  const selectedService = services.find((s) => s.serviceId === serviceId) ?? services[0];
  const effectiveServiceId = serviceId || selectedService?.serviceId || "";

  /**
   * The preview. Recomputed from the board's own numbers rather than
   * asked of the server, so it updates the instant a different service
   * is picked — and it uses the same "work queued ahead divided by
   * chairs" rule the backend does, which is why the two agree.
   */
  const preview = useMemo(() => {
    if (!board || !selectedService) return null;
    const aheadMinutes = board.waiting.reduce((total, entry) => total + entry.durationMinutes, 0);
    const capacity = Math.max(1, board.servingCapacity);
    return {
      position: board.waitingCount + 1,
      waitMinutes: Math.round(aheadMinutes / capacity),
    };
  }, [board, selectedService]);

  const close = () => {
    setName("");
    setPhone("");
    setServiceId("");
    setStaffUserId("");
    setNotes("");
    onClose();
  };

  return (
    <Modal open={open} onClose={close}>
      <div className="flex items-center justify-between px-6 pt-6">
        <h2 className="m-0 font-sans text-[19px] font-semibold text-tn-ink">Add Walk-in</h2>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="cursor-pointer border-none bg-transparent font-sans text-xl text-tn-muted-6"
        >
          &times;
        </button>
      </div>

      <form
        className="flex flex-col gap-4 px-6 pt-4 pb-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim() || !effectiveServiceId) return;
          onSubmit({
            customerName: name.trim(),
            customerPhone: phone.trim() || undefined,
            serviceId: effectiveServiceId,
            staffUserId: staffUserId || undefined,
            notes: notes.trim() || undefined,
          });
        }}
      >
        <p className="m-0 font-sans text-[13px] text-tn-muted-5">
          For customers without the app — front desk adds them straight to the queue.
        </p>

        <Field label="CUSTOMER NAME">
          <input
            type="text"
            placeholder="e.g. Robert Chen"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={formInputClass}
            required
          />
        </Field>

        <Field label="PHONE (OPTIONAL — SO THE DESK CAN CALL THEM)">
          <PhoneInput value={phone} onChange={setPhone} />
        </Field>

        <Field label="SERVICE">
          <select
            className={formSelectClass}
            value={effectiveServiceId}
            onChange={(e) => setServiceId(e.target.value)}
            disabled={servicesQuery.isPending}
          >
            {servicesQuery.isPending ? <option>Loading…</option> : null}
            {services.map((service) => (
              <option key={service.serviceId} value={service.serviceId}>
                {service.name} · {service.durationMinutes} min
              </option>
            ))}
          </select>
        </Field>

        <Field label="BARBER PREFERENCE">
          <select
            className={formSelectClass}
            value={staffUserId}
            onChange={(e) => setStaffUserId(e.target.value)}
          >
            <option value="">Any available barber</option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="NOTE (OPTIONAL)">
          <input
            type="text"
            placeholder="e.g. wants the same as last time"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={formInputClass}
          />
        </Field>

        {services.length === 0 && !servicesQuery.isPending ? (
          <p className="m-0 rounded-xl bg-tn-page p-3 font-sans text-xs text-tn-muted-3">
            This location has no bookable services yet — add some under Settings → Locations before
            taking walk-ins.
          </p>
        ) : preview ? (
          <p className="m-0 flex items-center gap-2 rounded-xl bg-tn-page p-3 font-sans text-xs text-tn-muted-3">
            <span aria-hidden>ℹ</span>
            Joins the queue at position #{preview.position} · estimated wait ~{preview.waitMinutes}{" "}
            min
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="m-0 font-sans text-[13px] text-tn-danger">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2.5">
          <Button variant="secondary" className="flex-1" onClick={close}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1"
            disabled={!name.trim() || !effectiveServiceId || pending}
          >
            {pending ? "Adding…" : "Add to Waitlist"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default AddWalkInModal;
