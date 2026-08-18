import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, formInputClass, formSelectClass } from "@/components/ui/FormField";
import { WizardTabs } from "@/components/ui/WizardTabs";
import { Toggle } from "@/components/ui/Toggle";
import { useAuthStore } from "@/auth/auth-store";
import { listLocations } from "@/lib/locations-api";
import { listRoles } from "@/lib/roles-api";
import { inviteStaff } from "@/lib/staff-api";
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

/**
 * Matches the mockup's T12h–T12l "Add New Member" 5-step wizard. Only
 * Profile's name/email/location and Role are real — those are the fields
 * staff.service.ts's inviteStaff actually persists. Services/Schedule/
 * Options stay exactly as visual as they were before (no staff↔services
 * assignment table or per-member schedule exists on the backend yet); they
 * still render and respond to input, just aren't sent anywhere on submit.
 *
 * Roles are the account's own custom staff_roles (see roles-api.ts) —
 * fetched live rather than a fixed 4-item list, so a role a shop owner
 * created or renamed on the Roles & Permissions screen shows up here
 * immediately.
 */
export function AddMemberWizard({ open, onClose }: AddMemberWizardProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [locationId, setLocationId] = useState("");
  const [assignedServices, setAssignedServices] = useState<Set<string>>(
    () => new Set(SERVICES.slice(0, 3).map((s) => s.id)),
  );
  const [roleId, setRoleId] = useState("");
  const [allowNoPayment, setAllowNoPayment] = useState(true);
  const [allowMultiService, setAllowMultiService] = useState(true);
  const [trackHours, setTrackHours] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: () => listLocations(accessToken ?? ""),
    enabled: !!accessToken && open,
  });
  const locations = locationsQuery.data?.locations ?? [];

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: () => listRoles(accessToken ?? ""),
    enabled: !!accessToken && open,
  });
  const roles = rolesQuery.data?.roles ?? [];

  // Default to the account's primary location the moment the list loads,
  // so a shop with just one location never has to touch this field.
  useEffect(() => {
    if (locationId || locations.length === 0) return;
    setLocationId(locations.find((l) => l.isPrimary)?.id ?? locations[0]!.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the list itself changes, not when locationId is cleared by handleClose below
  }, [locations]);

  // Default to the first non-Owner role (a brand-new member is almost
  // never the account's Owner) once roles load — mirrors the old fixed
  // list's "stylist" default, just picked dynamically now.
  useEffect(() => {
    if (roleId || roles.length === 0) return;
    setRoleId((roles.find((r) => !r.isSystem) ?? roles[0])!.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the list itself changes, not when roleId is cleared by handleClose below
  }, [roles]);

  const inviteMutation = useMutation({
    mutationFn: () =>
      inviteStaff(accessToken ?? "", {
        name: `${firstName} ${lastName}`.trim(),
        email,
        roleId,
        locationId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: ["staff-performance"] });
      handleClose();
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : "Couldn't send the invite — try again.");
    },
  });

  function handleClose() {
    onClose();
    setStep(0);
    setFirstName("");
    setLastName("");
    setEmail("");
    setLocationId("");
    setRoleId("");
    setFormError(null);
  }

  function toggleService(id: string) {
    setAssignedServices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function goNext() {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    if (!firstName.trim() || !email.trim()) {
      setStep(0);
      setFormError("Add at least a first name and email before sending the invite.");
      return;
    }
    if (!locationId) {
      setFormError("Pick a location for this member.");
      return;
    }
    if (!roleId) {
      setStep(3);
      setFormError("Pick a role for this member.");
      return;
    }
    setFormError(null);
    inviteMutation.mutate();
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
                <input
                  type="text"
                  placeholder="Jordan"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={formInputClass}
                />
              </Field>
              <Field label="LAST NAME">
                <input
                  type="text"
                  placeholder="Rivera"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={formInputClass}
                />
              </Field>
            </div>
            <Field label="PHONE">
              <input type="text" placeholder="(555) 555-0100" className={formInputClass} />
            </Field>
            <Field label="EMAIL">
              <input
                type="email"
                placeholder="jordan@thegentry.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={formInputClass}
              />
            </Field>
            <Field label="LOCATION">
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className={formSelectClass}
              >
                {locations.length === 0 && <option value="">Loading locations…</option>}
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </Field>
            <p className="m-0 font-sans text-xs text-tn-muted-5">
              No email gets sent — tell {firstName || "them"} out-of-band to sign in with Google
              using this exact address once you&rsquo;ve sent the invite.
            </p>
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
                <span className="font-sans text-[13px] text-tn-muted-3">${s.price.toFixed(2)}</span>
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
                      w.enabled
                        ? "border-tn-gold bg-tn-gold text-tn-on-dark"
                        : "border-tn-input-border"
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
              Pick a role to set what this member can access.
            </p>
            {rolesQuery.isPending && (
              <p className="m-0 font-sans text-[13px] text-tn-muted-5">Loading roles…</p>
            )}
            <div className="flex flex-col gap-2.5">
              {roles.map((r) => (
                <label
                  key={r.id}
                  className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                    roleId === r.id ? "border-tn-gold bg-tn-gold-bg-soft" : "border-tn-border"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    aria-label={r.name}
                    checked={roleId === r.id}
                    onChange={() => setRoleId(r.id)}
                    className="mt-1 accent-tn-gold"
                  />
                  <span>
                    <p className="m-0 font-sans text-[13px] font-semibold text-tn-ink">{r.name}</p>
                    {r.description && (
                      <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">
                        {r.description}
                      </p>
                    )}
                  </span>
                </label>
              ))}
            </div>
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
              <Toggle
                checked={trackHours}
                onChange={setTrackHours}
                label="Track hours for payroll"
              />
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
                Adding this member will use your last available seat, or add a prorated seat to your
                Business plan.
              </p>
            </div>
          </>
        )}

        {formError && <p className="m-0 font-sans text-sm text-tn-danger">{formError}</p>}

        <div className="flex gap-2.5 border-t border-tn-border-soft pt-4">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => (step === 0 ? handleClose() : setStep(step - 1))}
            disabled={inviteMutation.isPending}
          >
            {step === 0 ? "Cancel" : "← Back"}
          </Button>
          <Button className="flex-1" onClick={goNext} disabled={inviteMutation.isPending}>
            {step === STEPS.length - 1
              ? inviteMutation.isPending
                ? "Sending…"
                : "Send Invite"
              : `Next: ${STEPS[step + 1]} →`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default AddMemberWizard;
