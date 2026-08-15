import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, formInputClass } from "@/components/ui/FormField";
import { WizardTabs } from "@/components/ui/WizardTabs";
import { Toggle } from "@/components/ui/Toggle";
import { SERVICES } from "@/lib/sample-data";

interface AddMemberWizardProps {
  open: boolean;
  onClose: () => void;
}

const STEPS = ["Profile", "Services", "Schedule", "Role", "Options"];

const WEEK = [
  { day: "Sunday", enabled: false },
  { day: "Monday", enabled: true },
  { day: "Tuesday", enabled: true },
  { day: "Wednesday", enabled: true },
  { day: "Thursday", enabled: true },
  { day: "Friday", enabled: true },
  { day: "Saturday", enabled: true },
];

const ROLES = [
  { id: "owner", name: "Owner", body: "Full access to every location, billing, and settings." },
  { id: "manager", name: "Branch Manager", body: "Manages one location: staff, schedule, services, and reports." },
  { id: "barber", name: "Barber", body: "Manages own schedule, appointments, and clients." },
  { id: "receptionist", name: "Receptionist", body: "Books appointments and manages the front desk. No financial access." },
];

/** Matches the mockup's T12h–T12l "Add New Member" 5-step wizard. */
export function AddMemberWizard({ open, onClose }: AddMemberWizardProps) {
  const [step, setStep] = useState(0);
  const [assignedServices, setAssignedServices] = useState<Set<string>>(
    () => new Set(SERVICES.slice(0, 3).map((s) => s.id)),
  );
  const [role, setRole] = useState("barber");
  const [allowNoPayment, setAllowNoPayment] = useState(true);
  const [allowMultiService, setAllowMultiService] = useState(true);
  const [trackHours, setTrackHours] = useState(false);

  function handleClose() {
    onClose();
    setStep(0);
  }

  function toggleService(id: string) {
    setAssignedServices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Modal open={open} onClose={handleClose} width={560}>
      <div className="flex items-center justify-between px-6 pt-6">
        <h2 className="m-0 font-sans text-lg font-semibold text-tn-ink">Add New Member</h2>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="cursor-pointer border-none bg-transparent font-sans text-xl text-tn-muted-6"
        >
          &times;
        </button>
      </div>

      <div className="flex flex-col gap-5 px-6 pb-6 pt-4">
        <WizardTabs steps={STEPS} activeIndex={step} />

        {step === 0 && (
          <>
            <div className="flex items-center gap-3.5">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-tn-page text-xl">
                👤
              </div>
              <span className="font-sans text-[13px] font-medium text-tn-gold">
                Add member&rsquo;s photo
              </span>
            </div>
            <label className="flex items-center gap-2 font-sans text-[13px] text-tn-muted-1">
              <input type="checkbox" defaultChecked className="accent-tn-gold" />
              Visible Online
            </label>
            <div className="grid grid-cols-2 gap-3.5">
              <Field label="FIRST NAME">
                <input type="text" placeholder="Jordan" className={formInputClass} />
              </Field>
              <Field label="LAST NAME">
                <input type="text" placeholder="Rivera" className={formInputClass} />
              </Field>
            </div>
            <Field label="PHONE">
              <input type="text" placeholder="(555) 555-0100" className={formInputClass} />
            </Field>
            <Field label="EMAIL">
              <input type="text" placeholder="jordan@thegentry.com" className={formInputClass} />
            </Field>
            <Field label="APPOINTMENT COLOR">
              <div className="flex items-center gap-2.5">
                <span className="h-6 w-6 rounded-full bg-[#e8b23d]" />
                <span className="font-sans text-xs text-tn-muted-4">#e8b23d</span>
              </div>
            </Field>
          </>
        )}

        {step === 1 && (
          <div className="flex flex-col overflow-hidden rounded-xl border border-tn-border">
            <div className="grid grid-cols-[2fr_1fr_1fr_0.8fr] bg-tn-table-head px-4 py-2.5 font-sans text-xs font-semibold text-tn-muted-5">
              <span>SERVICE</span>
              <span>COST</span>
              <span>DURATION</span>
              <span>ASSIGNED</span>
            </div>
            {SERVICES.map((s, i) => (
              <label
                key={s.id}
                className={`grid grid-cols-[2fr_1fr_1fr_0.8fr] items-center px-4 py-3 ${
                  i < SERVICES.length - 1 ? "border-b border-tn-border-soft" : ""
                }`}
              >
                <span className="font-sans text-[13px] text-tn-ink">{s.name}</span>
                <span className="font-sans text-[13px] text-tn-muted-3">
                  ${s.price.toFixed(2)}
                </span>
                <span className="font-sans text-[13px] text-tn-muted-3">{s.duration}</span>
                <input
                  type="checkbox"
                  checked={assignedServices.has(s.id)}
                  onChange={() => toggleService(s.id)}
                  className="accent-tn-gold"
                />
              </label>
            ))}
          </div>
        )}

        {step === 2 && (
          <>
            <div className="grid grid-cols-2 gap-3.5">
              <Field label="STARTING DATE">
                <input type="text" defaultValue="12/28/2025" className={formInputClass} />
              </Field>
              <Field label="ENDING DATE">
                <input type="text" placeholder="No end date" className={formInputClass} />
              </Field>
            </div>
            <div className="flex flex-col gap-2">
              {WEEK.map((w) => (
                <div key={w.day} className="flex items-center gap-3">
                  <span
                    className={`flex h-[18px] w-[18px] items-center justify-center rounded border text-[11px] ${
                      w.enabled ? "border-tn-gold bg-tn-gold text-tn-on-dark" : "border-tn-input-border"
                    }`}
                  >
                    {w.enabled && "✓"}
                  </span>
                  <span className="w-24 font-sans text-[13px] text-tn-ink-soft">{w.day}</span>
                  {w.enabled ? (
                    <span className="font-sans text-[13px] text-tn-muted-3">9:00 am – 6:00 pm</span>
                  ) : (
                    <span className="font-sans text-[13px] text-tn-faint-2">Off</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <p className="m-0 font-sans text-[13px] text-tn-muted-4">
              Pick a role to set what this member can access. Roles are shared across your team —
              edit a role once and it updates everyone assigned to it.
            </p>
            <div className="flex flex-col gap-2.5">
              {ROLES.map((r) => (
                <label
                  key={r.id}
                  className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                    role === r.id ? "border-tn-gold bg-tn-gold-bg-soft" : "border-tn-border"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    checked={role === r.id}
                    onChange={() => setRole(r.id)}
                    className="mt-1 accent-tn-gold"
                  />
                  <span>
                    <p className="m-0 font-sans text-[13px] font-semibold text-tn-ink">{r.name}</p>
                    <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">{r.body}</p>
                  </span>
                </label>
              ))}
            </div>
            <a href="#" className="font-sans text-xs font-medium text-tn-gold">
              Manage roles &amp; permissions →
            </a>
          </>
        )}

        {step === 4 && (
          <>
            <div className="flex flex-col gap-1">
              <Toggle
                checked={allowNoPayment}
                onChange={setAllowNoPayment}
                label="Allow booking without payment"
              />
              <Toggle
                checked={allowMultiService}
                onChange={setAllowMultiService}
                label="Allow multiple services per booking"
              />
              <Toggle checked={trackHours} onChange={setTrackHours} label="Track hours for payroll" />
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <Field label="BOOKING INTERVAL (CLIENT)">
                <div className={formInputClass}>30 mins</div>
              </Field>
              <Field label="DAYS TO BOOK IN ADVANCE">
                <div className={formInputClass}>60</div>
              </Field>
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-tn-page p-3.5">
              <span aria-hidden>ℹ</span>
              <p className="m-0 font-sans text-xs text-tn-muted-4">
                Adding this member will use your last available seat, or add a prorated seat to
                your Business plan.
              </p>
            </div>
          </>
        )}

        <div className="flex gap-2.5 border-t border-tn-border-soft pt-4">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => (step === 0 ? handleClose() : setStep(step - 1))}
          >
            {step === 0 ? "Cancel" : "← Back"}
          </Button>
          <Button
            className="flex-1"
            onClick={() => (step === STEPS.length - 1 ? handleClose() : setStep(step + 1))}
          >
            {step === STEPS.length - 1 ? "Send Invite" : `Next: ${STEPS[step + 1]} →`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default AddMemberWizard;
