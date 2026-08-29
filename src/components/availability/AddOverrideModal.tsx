import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/FormField";
import { DatePicker } from "@/components/ui/DatePicker";
import { TimePicker } from "@/components/ui/TimePicker";
import type { UpsertOverrideInput } from "@/lib/availability-api";

interface AddOverrideModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: UpsertOverrideInput) => void;
  submitting: boolean;
}

/** Today, as "YYYY-MM-DD" in the browser's local timezone — the picker's min, so an override can't be backdated. */
function todayIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/**
 * The reference screenshot's "Add a date override" flow — pick a date,
 * then either block it entirely or give it its own custom hours for that
 * one day, overriding the regular weekly schedule (see
 * AvailabilitySettingsPage.tsx and availability-api.ts's
 * UpsertOverrideInput). Submitting the same date twice replaces the
 * earlier override rather than erroring, so this doubles as the "edit an
 * existing override" flow too.
 */
export function AddOverrideModal({ open, onClose, onSubmit, submitting }: AddOverrideModalProps) {
  const [date, setDate] = useState("");
  const [isUnavailable, setIsUnavailable] = useState(true);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");

  // Fresh form every time the modal opens, rather than showing whatever
  // was left over from the last override added.
  useEffect(() => {
    if (open) {
      setDate("");
      setIsUnavailable(true);
      setStartTime("09:00");
      setEndTime("17:00");
    }
  }, [open]);

  function handleSubmit() {
    if (!date) return;
    onSubmit({
      date,
      isUnavailable,
      startTime: isUnavailable ? undefined : startTime,
      endTime: isUnavailable ? undefined : endTime,
    });
  }

  return (
    <Modal open={open} onClose={onClose} width={400}>
      <div className="flex flex-col gap-5 p-6">
        <p className="m-0 font-sans text-lg font-semibold text-tn-ink">Add a date override</p>

        <Field label="DATE">
          {/* The app's own calendar, not <input type="date">. The native
              one opened the browser's chrome — blue accent, its own
              Clear/Today row, its own idea of dd/mm/yyyy — inside a modal
              whose every other control is ours, and the two didn't look
              like the same product. Same swap TimePicker made next to it. */}
          <DatePicker label="Override date" value={date} onChange={setDate} min={todayIso()} />
        </Field>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setIsUnavailable(true)}
            aria-pressed={isUnavailable}
            className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left font-sans text-sm font-medium ${
              isUnavailable
                ? "border-tn-gold bg-tn-gold-bg text-tn-ink"
                : "border-tn-input-border text-tn-ink-soft"
            }`}
          >
            Mark unavailable all day
          </button>
          <button
            type="button"
            onClick={() => setIsUnavailable(false)}
            aria-pressed={!isUnavailable}
            className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left font-sans text-sm font-medium ${
              !isUnavailable
                ? "border-tn-gold bg-tn-gold-bg text-tn-ink"
                : "border-tn-input-border text-tn-ink-soft"
            }`}
          >
            Custom hours for this date
          </button>
        </div>

        {!isUnavailable && (
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <TimePicker label="Override start time" value={startTime} onChange={setStartTime} />
            </div>
            <span className="font-sans text-xs text-tn-muted-6">to</span>
            <div className="flex-1">
              <TimePicker label="Override end time" value={endTime} onChange={setEndTime} />
            </div>
          </div>
        )}

        <div className="flex gap-2.5">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={!date || submitting}>
            {submitting ? "Saving…" : "Save override"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default AddOverrideModal;
