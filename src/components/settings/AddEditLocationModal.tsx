import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { Field, formInputClass } from "@/components/ui/FormField";
import { PhoneInput, isPhoneValid } from "@/components/ui/PhoneInput";
import { TimezonePicker } from "@/components/ui/TimezonePicker";
import { useAuthStore } from "@/auth/auth-store";
import { LocationMapPicker } from "@/components/settings/LocationMapPicker";
import { MapSearchField } from "@/components/settings/MapSearchField";
import {
  createLocation,
  updateLocation,
  reverseGeocodeLocation,
  type AccountLocation,
  type LocationInput,
  type GeocodeResult,
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
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [reversing, setReversing] = useState(false);
  const [geolocating, setGeolocating] = useState(false);
  /** Reverse-geocoded address for the current pin, offered as a suggestion rather than written straight into the form. */
  const [pinAddress, setPinAddress] = useState<string | null>(null);
  /** Which open this form's fields were seeded for — a location id, or "new". See the seeding block below. */
  const [seededFor, setSeededFor] = useState<string | null>(null);

  const isEditing = location !== null;

  // Reset to the freshly-clicked location (or a blank form for "+ Add
  // Location") every time the modal opens — it stays mounted between
  // opens, so without this it'd show whatever was last edited.
  //
  // Done during render rather than from an effect, which matters here
  // beyond tidiness: LocationMapPicker builds its Leaflet map from the
  // first latitude/longitude it sees and never re-centres on later prop
  // changes except through an imperative setView. Seeding after mount
  // meant Edit created the map at the default US-wide view and then flew
  // it to the pin at zoom 15 — a whole fresh tile grid being requested and
  // laid out in exactly the frames the sheet is supposed to be sliding in.
  // Adjusting state during render is React's documented answer to "props
  // changed, reset state"; the re-render happens before any child sees the
  // stale values, so the map is simply created in the right place.
  const openKey = open ? (location?.id ?? "new") : null;
  if (openKey === null) {
    // Cleared on close so reopening the *same* location seeds again,
    // matching the old effect's [open, location] dependency.
    if (seededFor !== null) setSeededFor(null);
  } else if (openKey !== seededFor) {
    setSeededFor(openKey);
    setForm(
      location
        ? {
            name: location.name,
            address: location.address,
            phone: location.phone ?? "",
            timezone: location.timezone ?? "",
          }
        : EMPTY_FORM,
    );
    setActive(location ? location.status === "active" : true);
    setLatitude(location?.latitude ?? null);
    setLongitude(location?.longitude ?? null);
    setFormError(null);
    setLocateError(null);
  }

  // Bumped on every pin move so a slow reverse-geocode response from a
  // stale drag can't clobber the address field after a newer one already
  // landed — only the latest request's result gets applied.
  const reverseGeocodeSeq = useRef(0);

  /** The map's own onChange — vice versa of handleLocateFromAddress: moving the pin (click or drag) reverse-geocodes it back into the ADDRESS field. */
  async function handleMapChange(lat: number, lng: number) {
    setLatitude(lat);
    setLongitude(lng);
    setLocateError(null);

    const seq = ++reverseGeocodeSeq.current;
    setReversing(true);
    try {
      const { displayName } = await reverseGeocodeLocation(accessToken ?? "", lat, lng);
      if (seq === reverseGeocodeSeq.current) {
        // Offered, not applied. Reverse geocoding returns whatever the
        // provider has nearest the pin — often an administrative area
        // rather than a street — so it's a suggestion the owner can take,
        // never a silent replacement for what they wrote.
        if (form.address.trim()) {
          setPinAddress(displayName);
        } else {
          setForm((f) => ({ ...f, address: displayName }));
        }
      }
    } catch {
      // Reverse lookup failing shouldn't block placing the pin — the owner
      // can still type/adjust the address by hand.
    } finally {
      if (seq === reverseGeocodeSeq.current) setReversing(false);
    }
  }

  /**
   * "Use my location" — the pattern every maps app has, and the fastest
   * path when an owner is adding the shop while standing in it.
   *
   * Resolves to the same place a map click does: move the pin, then offer
   * the nearest address as a suggestion. Accuracy varies wildly (real GPS
   * on a phone, a coarse IP-derived guess on desktop), so this positions
   * the pin for the owner to drag rather than pretending to be exact.
   *
   * getCurrentPosition only resolves in a secure context — https, or
   * localhost in development. Over plain http on a LAN address the
   * browser refuses outright with an error indistinguishable from the
   * owner denying permission, hence the explicit check.
   */
  function handleUseMyLocation() {
    if (!("geolocation" in navigator)) {
      setLocateError("This browser can't share a location — drop the pin by hand instead.");
      return;
    }
    if (!window.isSecureContext) {
      setLocateError(
        "Location sharing needs a secure (https) connection — drop the pin by hand instead.",
      );
      return;
    }

    setGeolocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeolocating(false);
        // Same handler the map's own click/drag uses, so the pin and the
        // address suggestion stay in sync through one code path.
        void handleMapChange(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        setGeolocating(false);
        // Distinct messages per case: "denied" needs a browser-settings
        // fix, the others are worth simply retrying, and conflating them
        // leaves the owner with no idea which situation they're in.
        if (error.code === error.PERMISSION_DENIED) {
          setLocateError(
            "Location access was blocked. Allow it in your browser's site settings, or drop the pin by hand.",
          );
        } else if (error.code === error.TIMEOUT) {
          setLocateError("Locating took too long — try again, or drop the pin by hand.");
        } else {
          setLocateError("Couldn't determine your location — drop the pin by hand.");
        }
      },
      // maximumAge: 0 — an owner standing in a new shop must not be handed
      // a cached fix from wherever they last used this browser.
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  }

  /**
   * A search result was picked. Moves the pin only — the ADDRESS field is
   * the owner's to write. The one exception is a genuinely empty address
   * on a brand-new location: there's nothing to overwrite, and prefilling
   * saves retyping what they just searched for.
   */
  function handleSearchSelected(result: GeocodeResult) {
    reverseGeocodeSeq.current++;
    setReversing(false);
    setLatitude(result.latitude);
    setLongitude(result.longitude);
    setLocateError(null);
    setPinAddress(null);
    if (!form.address.trim()) {
      setForm((f) => ({ ...f, address: result.displayName }));
    }
  }

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
        latitude,
        longitude,
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
    if (!isPhoneValid(form.phone ?? "")) {
      setFormError("That phone number doesn't look right for the selected country.");
      return;
    }
    setFormError(null);
    mutation.mutate();
  }

  return (
    // A side sheet rather than a centred card: adding or editing a
    // location is done against the list — you want the other sites still
    // visible to compare hours and copy settings from.
    <Modal open={open} onClose={onClose} width={460} variant="sheet">
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

          {/*
            Two fields, deliberately. ADDRESS is what gets stored and what
            a customer reads; the search box below only moves the pin. They
            used to be one control, which meant every pin nudge or picked
            suggestion overwrote the owner's address with the geocoder's
            own phrasing.
          */}
          <Field label="ADDRESS">
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="88 Burnet Rd, Austin, TX"
              className={formInputClass}
            />
          </Field>

          <Field label="LOCATION ON MAP (OPTIONAL)">
            <div className="flex flex-col gap-2">
              <MapSearchField
                onSelect={handleSearchSelected}
                proximity={
                  latitude != null && longitude != null ? { latitude, longitude } : undefined
                }
              />
              <LocationMapPicker
                latitude={latitude}
                longitude={longitude}
                onChange={handleMapChange}
              />
              <div className="flex items-center justify-between gap-2">
                <p className="m-0 font-sans text-xs text-tn-muted-5">
                  {reversing
                    ? "Updating address…"
                    : latitude != null && longitude != null
                      ? "Click the map or drag the pin to fine-tune — the address updates to match."
                      : "Click anywhere on the map to drop a pin."}
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  onClick={handleUseMyLocation}
                  disabled={geolocating}
                  title="Drop the pin where you are right now"
                >
                  {geolocating ? "Locating…" : "◎ Use my location"}
                </Button>
              </div>
              {pinAddress && pinAddress !== form.address && (
                <div className="flex items-center gap-2 rounded-lg bg-tn-page px-3 py-2">
                  <span className="flex-1 font-sans text-xs text-tn-muted-4">
                    Nearest address here: {pinAddress}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      setForm((f) => ({ ...f, address: pinAddress }));
                      setPinAddress(null);
                    }}
                  >
                    Use it
                  </Button>
                </div>
              )}
              {locateError && <p className="m-0 font-sans text-xs text-tn-danger">{locateError}</p>}
            </div>
          </Field>

          <Field label="PHONE (OPTIONAL)">
            <PhoneInput
              value={form.phone ?? ""}
              onChange={(phone) => setForm((f) => ({ ...f, phone }))}
            />
          </Field>

          {/*
            A picker, not a text field. This value is read straight back
            into Intl.DateTimeFormat server-side (shared/scheduling.ts), so
            a typo like "PKT" or a stray trailing space isn't a cosmetic
            problem — it used to throw a RangeError inside the Locations
            page's capacity pass and come back as a 500 for the whole list.
            Offering only real IANA ids removes the class of bug at the
            source; the API rejects bad values too, and the scheduling code
            falls back to UTC for rows written before either existed.
          */}
          <Field label="TIMEZONE (OPTIONAL)">
            <TimezonePicker
              value={form.timezone ?? ""}
              onChange={(timezone) => setForm((f) => ({ ...f, timezone }))}
              placeholder="Not set — bookings read in UTC"
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
