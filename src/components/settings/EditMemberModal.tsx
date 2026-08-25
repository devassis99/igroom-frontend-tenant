import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { WizardTabs } from "@/components/ui/WizardTabs";
import { Field, formInputClass, formSelectClass } from "@/components/ui/FormField";
import { useAuthStore } from "@/auth/auth-store";
import { listLocations } from "@/lib/locations-api";
import { listRoles } from "@/lib/roles-api";
import { updateStaff, type ServiceIdsByLocation, type StaffMember } from "@/lib/staff-api";
import { LocationMultiSelect } from "@/components/settings/LocationMultiSelect";
import { LocationServicesPicker } from "@/components/settings/LocationServicesPicker";

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
  const [locationIds, setLocationIds] = useState<string[]>([]);
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
  const [serviceIdsByLocation, setServiceIdsByLocation] = useState<ServiceIdsByLocation>({});
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

  // Driven by the *form's* current selection, not the member's saved
  // one, so ticking a shop in the Profile tab immediately offers its menu
  // on the Services tab. LocationServicesPicker fetches each shop's own
  // services itself.
  const selectedLocations = locations
    .filter((loc) => locationIds.includes(loc.id))
    .map((loc) => ({ id: loc.id, name: loc.name }));

  // Reset the form to the freshly-clicked member every time a new one opens
  // — this component stays mounted (AppShell-style) between opens, so
  // without this it'd show whichever member was edited last.
  useEffect(() => {
    if (!member) return;
    setTab(0);
    setName(member.name);
    setRoleId(member.roleId ?? "");
    setLocationIds(member.locations.map((loc) => loc.id));
    setCommissionRate(member.commissionRate === null ? "" : String(member.commissionRate));
    setRating(member.rating === null ? "" : String(member.rating));
    setDisplayTitle(member.displayTitle ?? "");
    setBio(member.bio ?? "");
    setSpecialtiesText(member.specialties.join(", "));
    setYearsExperience(member.yearsExperience === null ? "" : String(member.yearsExperience));
    setServiceIdsByLocation(member.serviceIdsByLocation);
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
        locationIds,
        commissionRate: commissionRate.trim() === "" ? null : Number(commissionRate),
        rating: rating.trim() === "" ? null : Number(rating),
        displayTitle: displayTitle.trim() === "" ? null : displayTitle.trim(),
        bio: bio.trim() === "" ? null : bio.trim(),
        specialties,
        yearsExperience: yearsExperience.trim() === "" ? null : Number(yearsExperience),
        // Always sent as the complete set — see StaffUpdateInput's comment.
        serviceIdsByLocation,
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
  /** Shops this member is being taken off — their assignments there go with them. */
  const removedLocations =
    member === null ? [] : member.locations.filter((loc) => !locationIds.includes(loc.id));

  function handleLocationsChange(nextLocationIds: string[]) {
    setLocationIds(nextLocationIds);
    // Assignments name the shop they apply at, so unticking one drops just
    // that shop's picks and leaves the rest alone — the backend prunes the
    // same way (see staff.service.ts's replaceStaffLocations), and dropping
    // them here keeps the Services tab honest about what's about to be
    // saved.
    setServiceIdsByLocation((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([id]) => nextLocationIds.includes(id))),
    );
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
    // A sheet, matching Add New Member — the two are the same form on
    // the same entity, and having one slide in from the edge while the
    // other rose from the centre read as two unrelated screens.
    <Modal open={member !== null} onClose={onClose} width={560} variant="sheet">
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

              <Field label="LOCATIONS">
                <LocationMultiSelect
                  locations={locations}
                  value={locationIds}
                  onChange={handleLocationsChange}
                  loading={locationsQuery.isPending}
                />
              </Field>
              {removedLocations.length > 0 && (
                <p className="m-0 -mt-2 font-sans text-xs text-tn-muted-5">
                  Saving removes this member from{" "}
                  {removedLocations.map((loc) => loc.name).join(", ")} and clears the services they
                  were assigned there. Their other shops are untouched.
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
                Which services this member can be booked for, at each shop they work at. The menu
                differs per shop, so the picks do too.
              </p>
              <LocationServicesPicker
                locations={selectedLocations}
                value={serviceIdsByLocation}
                onChange={setServiceIdsByLocation}
              />
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
