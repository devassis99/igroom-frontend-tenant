import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, formInputClass, formSelectClass } from "@/components/ui/FormField";
import { useAuthStore } from "@/auth/auth-store";
import { listLocations } from "@/lib/locations-api";
import { listRoles } from "@/lib/roles-api";
import { updateStaff, type StaffMember } from "@/lib/staff-api";

interface EditMemberModalProps {
  /** null closes the modal — same "undefined/null open state doubles as the value" pattern as ServicesPage's ServiceModal. */
  member: StaffMember | null;
  onClose: () => void;
}

/** The T12g ✎ "opens the profile edit" affordance — also reused by T10's Staff page (same member shape, same PATCH). Name, role, and location are what staff.service.ts's updateStaff has always persisted (Services/Schedule/Options aren't wired to anything real yet); Commission Rate and Rating are newer owner-entered fields it now also persists — there's no payroll-terms or customer-review module to compute either from, so they stay blank ("—" everywhere else in the app) until an owner sets them here. Roles are the account's own custom staff_roles (see roles-api.ts), fetched live rather than a fixed list. */
export function EditMemberModal({ member, onClose }: EditMemberModalProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const owner = useAuthStore((s) => s.owner);
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState("");
  const [locationId, setLocationId] = useState("");
  // Kept as strings (not number | null) so the input can sit genuinely
  // empty rather than snapping to 0 — submit converts "" to null.
  const [commissionRate, setCommissionRate] = useState("");
  const [rating, setRating] = useState("");
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

  // Reset the form to the freshly-clicked member every time a new one opens
  // — this component stays mounted (AppShell-style) between opens, so
  // without this it'd show whichever member was edited last.
  useEffect(() => {
    if (!member) return;
    setName(member.name);
    setRoleId(member.roleId ?? "");
    setLocationId(member.locationId);
    setCommissionRate(member.commissionRate === null ? "" : String(member.commissionRate));
    setRating(member.rating === null ? "" : String(member.rating));
    setFormError(null);
  }, [member]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!member) throw new Error("No member selected");
      return updateStaff(accessToken ?? "", member.id, {
        name,
        roleId,
        locationId,
        commissionRate: commissionRate.trim() === "" ? null : Number(commissionRate),
        rating: rating.trim() === "" ? null : Number(rating),
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("Give this member a name.");
      return;
    }
    if (commissionRate.trim() !== "") {
      const n = Number(commissionRate);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        setFormError("Commission rate must be a number between 0 and 100.");
        return;
      }
    }
    if (rating.trim() !== "") {
      const n = Number(rating);
      if (!Number.isFinite(n) || n < 0 || n > 5) {
        setFormError("Rating must be a number between 0 and 5.");
        return;
      }
    }
    setFormError(null);
    mutation.mutate();
  }

  return (
    <Modal open={member !== null} onClose={onClose} width={420}>
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

        <div className="flex flex-col gap-4 px-6 pb-6 pt-4">
          <Field label="NAME">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={formInputClass}
            />
          </Field>

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

          <Field label="LOCATION">
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className={formSelectClass}
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </Field>

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
