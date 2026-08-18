import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { Field, formInputClass } from "@/components/ui/FormField";
import { useAuthStore } from "@/auth/auth-store";
import {
  createLocation,
  updateLocation,
  type AccountLocation,
  type LocationInput,
} from "@/lib/locations-api";

interface AddEditLocationModalProps {
  open: boolean;
  onClose: () => void;
  /** null = T12d's "+ Add Location" (create). Set = editing that card. */
  location: AccountLocation | null;
}

const EMPTY_FORM: LocationInput = { name: "", address: "", phone: "", timezone: "" };

/**
 * T12d's "+ Add Location" doesn't get a dedicated mockup frame (same
 * "undesigned-but-implied" call-out as CategoriesModal.tsx) — this reuses
 * the same field set for both adding a new location and editing an
 * existing card, following EditMemberModal's create/edit-in-one-modal
 * shape. Editing also exposes the Active/Inactive status pill from the
 * T12d card as a toggle; the primary location's toggle is disabled since
 * locations.service.ts rejects deactivating it server-side.
 */
export function AddEditLocationModal({ open, onClose, location }: AddEditLocationModalProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const [form, setForm] = useState<LocationInput>(EMPTY_FORM);
  const [active, setActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const isEditing = location !== null;

  // Reset to the freshly-clicked location (or a blank form for "+ Add
  // Location") every time the modal opens — it stays mounted between
  // opens, so without this it'd show whatever was last edited.
  useEffect(() => {
    if (!open) return;
    if (location) {
      setForm({
        name: location.name,
        address: location.address,
        phone: location.phone ?? "",
        timezone: location.timezone ?? "",
      });
      setActive(location.status === "active");
    } else {
      setForm(EMPTY_FORM);
      setActive(true);
    }
    setFormError(null);
  }, [open, location]);

  function invalidate() {
    // Staff Management's Add/Edit Member location picker (EditMemberModal,
    // AddMemberWizard) reads this same ["locations"] query.
    queryClient.invalidateQueries({ queryKey: ["locations"] });
  }

  const mutation = useMutation({
    mutationFn: () => {
      const input: LocationInput = {
        name: form.name.trim(),
        address: form.address.trim(),
        phone: form.phone?.trim() ? form.phone.trim() : null,
        timezone: form.timezone?.trim() ? form.timezone.trim() : null,
      };
      if (location) {
        return updateLocation(accessToken ?? "", location.id, {
          ...input,
          status: active ? "active" : "inactive",
        });
      }
      return createLocation(accessToken ?? "", input);
    },
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : "Couldn't save this location — try again.");
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.address.trim()) {
      setFormError("A location needs at least a name and an address.");
      return;
    }
    setFormError(null);
    mutation.mutate();
  }

  return (
    <Modal open={open} onClose={onClose} width={440}>
      <form onSubmit={handleSubmit}>
        <div className="flex items-center justify-between px-6 pt-6">
          <h2 className="m-0 font-sans text-lg font-semibold text-tn-ink">
            {isEditing ? "Edit Location" : "Add Location"}
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
          <Field label="NAME">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="The Gentry · North Loop"
              className={formInputClass}
            />
          </Field>

          <Field label="ADDRESS">
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="88 Burnet Rd, Austin, TX"
              className={formInputClass}
            />
          </Field>

          <Field label="PHONE (OPTIONAL)">
            <input
              type="tel"
              value={form.phone ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="(555) 555-0100"
              className={formInputClass}
            />
          </Field>

          <Field label="TIMEZONE (OPTIONAL)">
            <input
              type="text"
              value={form.timezone ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
              placeholder="America/Chicago"
              className={formInputClass}
            />
          </Field>

          {isEditing && (
            <div className="rounded-xl border border-tn-border-soft px-3.5 py-1">
              <Toggle
                checked={active}
                onChange={setActive}
                disabled={location?.isPrimary}
                label={location?.isPrimary ? "Active (primary location)" : "Active"}
              />
              {location?.isPrimary && (
                <p className="m-0 pb-2.5 font-sans text-xs text-tn-muted-5">
                  Your primary location can&rsquo;t be deactivated.
                </p>
              )}
            </div>
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
              {mutation.isPending ? "Saving…" : isEditing ? "Save Changes" : "Add Location"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default AddEditLocationModal;
