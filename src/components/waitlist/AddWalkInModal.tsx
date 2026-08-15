import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, formInputClass, formSelectClass } from "@/components/ui/FormField";

interface AddWalkInModalProps {
  open: boolean;
  onClose: () => void;
}

/** Matches the mockup's T8c "Add Walk-in" modal. */
export function AddWalkInModal({ open, onClose }: AddWalkInModalProps) {
  const [name, setName] = useState("");

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex items-center justify-between px-6 pt-6">
        <h2 className="m-0 font-sans text-[19px] font-semibold text-tn-ink">Add Walk-in</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="cursor-pointer border-none bg-transparent font-sans text-xl text-tn-muted-6"
        >
          &times;
        </button>
      </div>

      <div className="flex flex-col gap-4 px-6 pb-6 pt-4">
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
          />
        </Field>
        <Field label="PHONE (OPTIONAL — FOR SMS ALERTS)">
          <input type="text" placeholder="(555) 555-0100" className={formInputClass} />
        </Field>
        <Field label="SERVICE">
          <select className={formSelectClass}>
            <option>Classic Haircut</option>
            <option>Haircut & Beard Trim</option>
            <option>Skin Fade</option>
            <option>Hot Towel Shave</option>
          </select>
        </Field>
        <Field label="BARBER PREFERENCE">
          <select className={formSelectClass}>
            <option>Any available barber</option>
            <option>Marcus Webb</option>
            <option>Devon Price</option>
            <option>Ray Ortiz</option>
          </select>
        </Field>

        <div className="flex items-center gap-2 rounded-xl bg-tn-page p-3 font-sans text-xs text-tn-muted-3">
          <span aria-hidden>ℹ</span>
          Joins the queue at position #4 · estimated wait ~30 min
        </div>

        <div className="flex gap-2.5">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={!name.trim()} onClick={onClose}>
            Add to Waitlist
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default AddWalkInModal;
