import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";

interface AppointmentModalProps {
  open: boolean;
  onClose: () => void;
}

type Mode = "detail" | "reschedule" | "cancel";

const TIME_SLOTS = ["10:00", "10:45", "1:00 PM", "3:15", "4:00", "4:45"];

/**
 * One modal covering all three of the mockup's appointment-detail frames
 * (T7c detail, T7d reschedule, T7e cancel) — they're the same appointment
 * moving through states rather than three separate screens, so one
 * component with an internal `mode` avoids duplicating the header/customer
 * strip three times.
 */
export function AppointmentModal({ open, onClose }: AppointmentModalProps) {
  const [mode, setMode] = useState<Mode>("detail");
  const [selectedTime, setSelectedTime] = useState("1:00 PM");
  const [refundChoice, setRefundChoice] = useState<"refund" | "keep">("refund");

  function handleClose() {
    onClose();
    setMode("detail");
  }

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
                <p className="m-0 font-sans text-base font-semibold text-tn-ink">Jordan Rivera</p>
                <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">
                  (555) 555-0182 · 3rd visit
                </p>
              </div>
              <StatusPill tone="success">Confirmed</StatusPill>
            </div>

            <div className="flex flex-col overflow-hidden rounded-xl border border-tn-border">
              {[
                ["Service", "Haircut & Beard Trim"],
                ["Barber", "Marcus Webb"],
                ["Date & time", "Wed, Aug 12 · 1:00 PM"],
                ["Duration", "45 min"],
                ["Booked via", "iGroom app"],
                ["Payment", "$32.00 paid · $8 deposit online"],
              ].map(([label, value], i, arr) => (
                <div
                  key={label}
                  className={`flex justify-between px-4 py-3 ${i < arr.length - 1 ? "border-b border-tn-border-soft" : ""}`}
                >
                  <span className="font-sans text-[13px] text-tn-muted-5">{label}</span>
                  <span className="font-sans text-[13px] font-semibold text-tn-ink-soft">
                    {value}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-2.5">
              <Button variant="secondary" className="flex-1" onClick={() => setMode("reschedule")}>
                Reschedule
              </Button>
              <Button variant="secondary" className="flex-1">
                Message
              </Button>
              <Button className="flex-1">Check In</Button>
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

        {mode === "reschedule" && (
          <>
            <div className="flex items-center gap-3 rounded-xl bg-tn-page p-3.5">
              <div className="h-9 w-9 flex-none rounded-full bg-[oklch(88%_0.02_40)]" />
              <div>
                <p className="m-0 font-sans text-[13px] font-semibold text-tn-ink">
                  Jordan Rivera · Haircut & Beard Trim
                </p>
                <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">
                  Currently Wed, Aug 12 · 1:00 PM with Marcus Webb
                </p>
              </div>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="font-sans text-xs font-medium text-tn-muted-1">NEW DATE</span>
              <div className="flex items-center gap-2.5 rounded-xl border border-tn-input-border px-3.5 py-3">
                <span className="flex-1 font-sans text-sm text-tn-ink">Thu, Aug 13, 2026</span>
                <span aria-hidden>📅</span>
              </div>
            </label>

            <div>
              <span className="font-sans text-xs font-medium text-tn-muted-1">
                NEW TIME · MARCUS WEBB
              </span>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {TIME_SLOTS.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    disabled={slot === "4:45"}
                    onClick={() => setSelectedTime(slot)}
                    className={`rounded-lg py-2 text-center font-sans text-xs font-medium ${
                      slot === selectedTime
                        ? "bg-tn-dark text-tn-on-dark"
                        : slot === "4:45"
                          ? "cursor-not-allowed bg-tn-page text-tn-faint-2"
                          : "border border-tn-input-border text-tn-muted-3"
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 font-sans text-[13px] text-tn-muted-1">
              <input type="checkbox" defaultChecked className="accent-tn-gold" />
              Notify customer by SMS
            </label>

            <div className="flex gap-2.5 border-t border-tn-border-soft pt-3">
              <Button variant="secondary" className="flex-1" onClick={() => setMode("detail")}>
                Back
              </Button>
              <Button className="flex-1" onClick={() => setMode("detail")}>
                Confirm New Time
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
                  Jordan Rivera · Haircut & Beard Trim
                </p>
                <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">
                  Wed, Aug 12 · 1:00 PM with Marcus Webb
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 rounded-xl border border-tn-border bg-tn-page p-3.5">
              <div className="flex items-center gap-2">
                <span className="text-tn-danger" aria-hidden>
                  ⚠
                </span>
                <p className="m-0 font-sans text-[13px] font-semibold text-tn-ink">
                  $8.00 deposit was paid online
                </p>
              </div>
              <p className="m-0 font-sans text-xs text-tn-muted-4">
                Choose whether to refund it or keep it as a cancellation fee.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label
                className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 font-sans text-[13px] font-medium ${
                  refundChoice === "refund"
                    ? "border-tn-gold bg-tn-gold-bg-soft text-tn-ink-soft"
                    : "border-tn-border text-tn-muted-3"
                }`}
              >
                <input
                  type="radio"
                  name="refund"
                  checked={refundChoice === "refund"}
                  onChange={() => setRefundChoice("refund")}
                  className="accent-tn-gold"
                />
                Refund the $8.00 deposit
              </label>
              <label
                className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 font-sans text-[13px] font-medium ${
                  refundChoice === "keep"
                    ? "border-tn-gold bg-tn-gold-bg-soft text-tn-ink-soft"
                    : "border-tn-border text-tn-muted-3"
                }`}
              >
                <input
                  type="radio"
                  name="refund"
                  checked={refundChoice === "keep"}
                  onChange={() => setRefundChoice("keep")}
                  className="accent-tn-gold"
                />
                Keep as cancellation fee
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="font-sans text-xs font-medium text-tn-muted-1">
                REASON (OPTIONAL)
              </span>
              <select className="rounded-xl border border-tn-input-border px-3.5 py-3 font-sans text-sm text-tn-ink">
                <option>Customer requested</option>
                <option>Shop closure / staff unavailable</option>
                <option>No-show</option>
                <option>Other</option>
              </select>
            </label>

            <label className="flex items-center gap-2 font-sans text-[13px] text-tn-muted-1">
              <input type="checkbox" defaultChecked className="accent-tn-gold" />
              Notify customer by SMS
            </label>

            <div className="flex gap-2.5 border-t border-tn-border-soft pt-3">
              <Button variant="secondary" className="flex-1" onClick={() => setMode("detail")}>
                Keep Appointment
              </Button>
              <Button variant="danger" className="flex-1" onClick={handleClose}>
                Cancel Appointment
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default AppointmentModal;
