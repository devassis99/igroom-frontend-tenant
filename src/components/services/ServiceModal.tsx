import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, formInputClass, formSelectClass } from "@/components/ui/FormField";
import { Toggle } from "@/components/ui/Toggle";
import type { Service } from "@/lib/sample-data";

interface ServiceModalProps {
  open: boolean;
  onClose: () => void;
  service: Service | null;
}

/** Matches the mockup's T9b Add/Edit Service modal. */
export function ServiceModal({ open, onClose, service }: ServiceModalProps) {
  const [onlineVisible, setOnlineVisible] = useState(true);
  const [requiresDeposit, setRequiresDeposit] = useState(false);
  const [bookableAtKiosk, setBookableAtKiosk] = useState(true);

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex items-center justify-between px-6 pt-6">
        <h2 className="m-0 font-sans text-xl font-semibold text-tn-ink">
          {service ? "Edit Service" : "Add Service"}
        </h2>
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
        <Field label="SERVICE NAME">
          <input
            type="text"
            defaultValue={service?.name ?? "Beard Color"}
            className={formInputClass}
          />
        </Field>
        <Field label="DESCRIPTION (MAX 300 CHARACTERS)">
          <textarea
            defaultValue={
              service?.description ?? "Cover gray and even out beard tone with a semi-permanent color."
            }
            rows={2}
            className={`${formInputClass} resize-none`}
          />
        </Field>
        <Field label="CATEGORY">
          <select defaultValue={service?.category || "Coloring"} className={formSelectClass}>
            <option>Coloring</option>
            <option>Haircuts</option>
            <option>Combos</option>
          </select>
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="font-sans text-xs font-medium text-tn-muted-1">SELECT TYPE OF TAX</span>
          <label className="flex items-center gap-2.5 rounded-xl border border-tn-input-border px-3.5 py-3 font-sans text-sm text-tn-ink">
            <input type="checkbox" defaultChecked className="accent-tn-gold" />
            Sales Tax 8.25%
          </label>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="font-sans text-xs font-medium text-tn-muted-1">SERVICE DURATION</span>
          <div className="flex gap-2">
            <select className={`${formSelectClass} flex-1`}>
              <option>0 hours</option>
              <option>1 hour</option>
            </select>
            <select className={`${formSelectClass} flex-1`}>
              <option>30 min</option>
              <option>45 min</option>
              <option>60 min</option>
            </select>
          </div>
        </div>

        <Field label="PRICING">
          <input
            type="text"
            defaultValue={service ? `$ ${service.price.toFixed(2)}` : "$ 35.00"}
            className={formInputClass}
          />
        </Field>

        <div className="flex flex-col gap-1 border-t border-tn-border-soft pt-3">
          <Toggle checked={onlineVisible} onChange={setOnlineVisible} label="Online visibility" />
          <Toggle
            checked={requiresDeposit}
            onChange={setRequiresDeposit}
            label="Requires prepaid deposit"
          />
          <Toggle
            checked={bookableAtKiosk}
            onChange={setBookableAtKiosk}
            label="Bookable at kiosk (walk-in)"
          />
        </div>

        <div className="flex gap-2.5">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={onClose}>
            Save Service
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default ServiceModal;
