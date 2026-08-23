import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { WizardTabs } from "@/components/ui/WizardTabs";
import { Field, formInputClass, formSelectClass } from "@/components/ui/FormField";
import { useAuthStore } from "@/auth/auth-store";
import { listLocations } from "@/lib/locations-api";
import { listRoles } from "@/lib/roles-api";
import { listServices } from "@/lib/services-api";
import { updateStaff, type StaffMember } from "@/lib/staff-api";

interface EditMemberModalProps {
  /** null closes the modal — same "undefined/null open state doubles as the value" pattern as ServicesPage's ServiceModal. */
  member: StaffMember | null;
  onClose: () => void;
}

const TABS = ["Profile", "Services", "Role & Pay"];

/**
 * The T12g ✎ "opens the profile edit" affordance — also reused by T10's
 * Staff page (same member shape, same PATCH).
 *
 * Tabbed rather than one long form, matching AddMemberWizard's own
 * Profile/Services/... shape so the add and edit paths read the same way.
 * Unlike the wizard these tabs are directly clickable (WizardTabs'
 * `onSelect` form): there's no ordered flow when editing an existing
 * member, and an owner who opened this to fix one field shouldn't have to
 * page through the others. All three tabs submit together — Save Changes
 * sends one PATCH regardless of which tab is showing.
 *
 * What's real here now: name, role, location, commission rate and rating
 * (as before), plus the Barber Profile columns staff_users has carried
 * since T09e but nothing could write (displayTitle/bio/specialties/
 * yearsExperience), plus genuine staff↔services assignment via the
 * staff_services join table. Per-member *schedules* are still not
 * editable from here — staff_availability is written through
 * /availability/me by the member themselves, so there's no owner-scoped
 * endpoint to point a Schedule tab at yet.
 *
 * Roles are the account's own custom staff_roles (see roles-api.ts) and
 * services are the menu at *this member's* location (which needn't be the
 * editing owner's own — hence the explicit locationId argument).
 */
export function EditMemberModal({ member, onClose }: EditMemberModalProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const owner = useAuthStore((s) => s.owner);
  const queryClient = useQueryClient();

  const [tab, setTab] = useState(0);
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState("");
  const [locationId, setLocationId] = useState("");
  // Kept as strings (not number | null) so the input can sit genuinely
  // empty rather than snapping to 0 — submit converts "" to null.
  const [commissionRate, setCommissionRate] = useState("");
  const [rating, setRating] = useState("");
  const [displayTitle, setDisplayTitle] = useState("");
  const [bio, setBio] = useState("");
  // Comma-separated in the input, string[] on the wire — a real chip
  // editor is more UI than this one field warrants, and the column is a
  // plain text[] of short tags either way (see staff-users.ts).
  const [specialtiesText, setSpecialtiesText] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: () => listLocations(accessToken ?? ""),
    enabled: !!accessToken && member !== null,
  });
  const locations = locationsQuery.data?.locations ?? [];

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: () => listRoles(accessToken ?? ""),
    enabled: !!accessToken && member !== null,
  });
  const roles = rolesQuery.data?.roles ?? [];

  // Keyed by the *form's* current locationId, not the member's saved one,
  // so switching location in the Profile tab immediately re-fetches the
  // right menu instead of showing the old location's services.
  const servicesQuery = useQuery({
    queryKey: ["services", locationId],
    queryFn: () => listServices(accessToken ?? "", locationId),
    enabled: !!accessToken && member !== null && locationId !== "",
  });
  const services = servicesQuery.data?.services ?? [];

  // Reset the form to the freshly-clicked member every time a new one opens
  // — this component stays mounted (AppShell-style) between opens, so
  // without this it'd show whichever member was edited last.
  useEffect(() => {
    if (!member) return;
    setTab(0);
    setName(member.name);
    setRoleId(member.roleId ?? "");
    setLocationId(member.locationId);
    setCommissionRate(member.commissionRate === null ? "" : String(member.commissionRate));
    setRating(member.rating === null ? "" : String(member.rating));
    setDisplayTitle(member.displayTitle ?? "");
    setBio(member.bio ?? "");
    setSpecialtiesText(member.specialties.join(", "));
    setYearsExperience(member.yearsExperience === null ? "" : String(member.yearsExperience));
    setServiceIds(member.serviceIds);
    setFormError(null);
  }, [member]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!member) throw new Error("No member selected");
      const specialties = specialtiesText
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      return updateStaff(accessToken ?? "", member.id, {
        name,
        roleId,
        locationId,
        commissionRate: commissionRate.trim() === "" ? null : Number(commissionRate),
        rating: rating.trim() === "" ? null : Number(rating),
        displayTitle: displayTitle.trim() === "" ? null : displayTitle.trim(),
        bio: bio.trim() === "" ? null : bio.trim(),
        specialties,
        yearsExperience: yearsExperience.trim() === "" ? null : Number(yearsExperience),
        // Always sent as the complete set — see StaffUpdateInput's comment.
        serviceIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: ["staff-performance"] });
      // See StaffManagementPage's toggleActiveMutation comment — Calendar's
      // Day view roster is a separate cache entry keyed ["bookings-staff",
      // locationId], so a name/role/location change wouldn't show up there
      // without this.
      queryClient.invalidateQueries({ queryKey: ["bookings-staff"] });
      onClose();
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : "Couldn't save — try again.");
    },
  });

  // staff.service.ts blocks a self-role-change server-side regardless —
  // disabling it here is just so clicking it doesn't end in a surprising
  // 403 for the one role you're most likely to click your own row for.
  const isSelf = member !== null && owner !== null && member.email === owner.workEmail;
  const movedLocation = member !== null && locationId !== member.locationId;

  function toggleService(id: string) {
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  function handleLocationChange(nextLocationId: string) {
    setLocationId(nextLocationId);
    // Assignments are location-scoped, so the previous location's picks
    // can't carry over — the backend clears them on a move anyway (see
    // staff.service.ts's updateStaff), and dropping them here keeps the
    // Services tab honest about what's about to be saved.
    setServiceIds([]);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setTab(0);
      setFormError("Give this member a name.");
      return;
    }
    if (commissionRate.trim() !== "") {
      const n = Number(commissionRate);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        setTab(2);
        setFormError("Commission rate must be a number between 0 and 100.");
        return;
      }
    }
    if (rating.trim() !== "") {
      const n = Number(rating);
      if (!Number.isFinite(n) || n < 0 || n > 5) {
        setTab(2);
        setFormError("Rating must be a number between 0 and 5.");
        return;
      }
    }
    if (yearsExperience.trim() !== "") {
      const n = Number(yearsExperience);
      if (!Number.isFinite(n) || n < 0 || n > 80) {
        setTab(0);
        setFormError("Years of experience must be a number between 0 and 80.");
        return;
      }
    }
    setFormError(null);
    mutation.mutate();
  }

  return (
    <Modal open={member !== null} onClose={onClose} width={560}>
      <form onSubmit={handleSubmit}>
        <div className="flex items-center justify-between px-6 pt-6">
          <h2 className="m-0 font-sans text-lg font-semibold text-tn-ink">Edit Member</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer border-none bg-transparent font-sans text-xl text-tn-muted-6"
          >
            &times;
          </button>
        </div>

        <div className="px-6 pt-4">
          <WizardTabs steps={TABS} activeIndex={tab} onSelect={setTab} />
        </div>

        <div className="flex flex-col gap-4 px-6 pb-6 pt-4">
          {tab === 0 && (
            <>
              <Field label="NAME">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={formInputClass}
                />
              </Field>

              <Field label="LOCATION">
                <select
                  value={locationId}
                  onChange={(e) => handleLocationChange(e.target.value)}
                  className={formSelectClass}
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </Field>
              {movedLocation && (
                <p className="m-0 -mt-2 font-sans text-xs text-tn-muted-5">
                  Moving locations clears this member&rsquo;s assigned services — pick their new
                  ones on the Services tab before saving.
                </p>
              )}

              <div className="grid grid-cols-2 gap-3.5">
                <Field label="DISPLAY TITLE">
                  <input
                    type="text"
                    placeholder="Senior Barber"
                    value={displayTitle}
                    onChange={(e) => setDisplayTitle(e.target.value)}
                    className={formInputClass}
                  />
                </Field>
                <Field label="YEARS EXPERIENCE">
                  <input
                    type="number"
                    min={0}
                    max={80}
                    step={1}
                    placeholder="—"
                    value={yearsExperience}
                    onChange={(e) => setYearsExperience(e.target.value)}
                    className={formInputClass}
                  />
                </Field>
              </div>

              <Field label="SPECIALTIES">
                <input
                  type="text"
                  placeholder="Skin fades, Beard sculpting"
                  value={specialtiesText}
                  onChange={(e) => setSpecialtiesText(e.target.value)}
                  className={formInputClass}
                />
              </Field>
              <p className="m-0 -mt-2 font-sans text-xs text-tn-muted-5">Separate with commas.</p>

              <Field label="BIO">
                <textarea
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className={`${formInputClass} resize-y`}
                />
              </Field>
              <p className="m-0 -mt-2 font-sans text-xs text-tn-muted-5">
                Display title, specialties and bio show on this member&rsquo;s public profile in the
                customer app.
              </p>
            </>
          )}

          {tab === 1 && (
            <>
              <p className="m-0 font-sans text-xs text-tn-muted-5">
                Which services this member can be booked for at{" "}
                {locations.find((l) => l.id === locationId)?.name ?? "their location"}.
              </p>
              {servicesQuery.isPending && (
                <p className="m-0 font-sans text-sm text-tn-muted-5">Loading services…</p>
              )}
              {servicesQuery.isError && (
                <p className="m-0 font-sans text-sm text-tn-danger">
                  Couldn&rsquo;t load services — close and try again.
                </p>
              )}
              {servicesQuery.isSuccess && services.length === 0 && (
                <p className="m-0 font-sans text-sm text-tn-muted-5">
                  No services exist at this location yet — add some on the Services page first.
                </p>
              )}
              {services.length > 0 && (
                <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
                  {services.map((service) => (
                    <label
                      key={service.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-2 hover:bg-tn-border-soft/40"
                    >
                      <input
                        type="checkbox"
                        checked={serviceIds.includes(service.id)}
                        onChange={() => toggleService(service.id)}
                        className="size-4 accent-tn-gold"
                      />
                      <span className="font-sans text-sm text-tn-ink">{service.name}</span>
                      <span className="ml-auto font-sans text-xs text-tn-muted-5">
                        {service.durationMinutes} min
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {services.length > 0 && (
                <p className="m-0 font-sans text-xs text-tn-muted-5">
                  {serviceIds.length} of {services.length} selected.
                </p>
              )}
            </>
          )}

          {tab === 2 && (
            <>
              <Field label="ROLE">
                <select
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                  disabled={isSelf}
                  className={formSelectClass}
                >
                  {roleId === "" && <option value="">Loading roles…</option>}
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </Field>
              {isSelf && (
                <p className="m-0 -mt-2 font-sans text-xs text-tn-muted-5">
                  You can&rsquo;t change your own role — ask an owner or manager.
                </p>
              )}

              <div className="grid grid-cols-2 gap-3.5">
                <Field label="COMMISSION RATE (%)">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    placeholder="—"
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(e.target.value)}
                    className={formInputClass}
                  />
                </Field>
                <Field label="RATING (0–5)">
                  <input
                    type="number"
                    min={0}
                    max={5}
                    step={0.1}
                    placeholder="—"
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                    className={formInputClass}
                  />
                </Field>
              </div>
              <p className="m-0 -mt-2 font-sans text-xs text-tn-muted-5">
                Used on the Staff page to calculate commission payout and show a star rating. Leave
                blank if unknown.
              </p>
            </>
          )}

          {formError && <p className="m-0 font-sans text-sm text-tn-danger">{formError}</p>}

          <div className="flex gap-2.5 pt-1">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default EditMemberModal;
