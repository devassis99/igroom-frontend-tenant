import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Field, formControlHeightClass, formInputClass } from "@/components/ui/FormField";
import { PhoneInput, isPhoneValid } from "@/components/ui/PhoneInput";
import { TimezonePicker } from "@/components/ui/TimezonePicker";
import { LocationMapPicker } from "@/components/settings/LocationMapPicker";
import { MapSearchField } from "@/components/settings/MapSearchField";
import { LocationAvailabilityTab } from "@/components/settings/location-tabs/LocationAvailabilityTab";
import { LocationStaffTab } from "@/components/settings/location-tabs/LocationStaffTab";
import { LocationServicesTab } from "@/components/settings/location-tabs/LocationServicesTab";
import { LocationPayoutsTab } from "@/components/settings/location-tabs/LocationPayoutsTab";
import { useAuthStore } from "@/auth/auth-store";
import { env } from "@/lib/env";
import {
  reverseGeocodeLocation,
  type GeocodeResult,
  updateLocation,
  type AccountLocation,
} from "@/lib/locations-api";

const TABS = [
  { key: "details", label: "Details" },
  { key: "availability", label: "Availability" },
  { key: "staff", label: "Staff" },
  { key: "services", label: "Services & pricing" },
  { key: "payouts", label: "Payouts" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/** Same URL the QR encodes — null when no public booking site is configured (see env.ts). */
function bookingUrlFor(location: AccountLocation): string | null {
  const base = env.VITE_BOOKING_BASE_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/l/${location.id}`;
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * The Locations mockup's frame 1b: one location's whole world on one
 * screen, instead of a modal that could only ever hold the fields.
 *
 * Availability, staff, the menu and the takings are all questions an owner asks
 * *about a specific shop*, and answering them used to mean four different
 * pages with a location filter on each. This is why the ops table stays
 * alongside it: the table answers "how are all my shops doing", this
 * answers "what is going on at this one".
 */
export function LocationDetailPanel({
  location,
  canManage,
}: {
  location: AccountLocation;
  canManage: boolean;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>("details");

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="tn-content-in flex flex-wrap items-start justify-between gap-3 border-b border-tn-border-soft pb-4">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h2 className="m-0 font-serif text-2xl font-semibold text-tn-ink">{location.name}</h2>
            <span
              className={`rounded-full px-2.5 py-0.5 font-sans text-[10px] font-semibold tracking-[0.04em] ${
                location.status === "active"
                  ? "bg-tn-success-bg text-tn-success"
                  : "bg-tn-neutral-bg text-tn-muted-5"
              }`}
            >
              {location.status === "active" ? "ACTIVE" : "INACTIVE"}
            </span>
            {location.isPrimary && (
              <span className="rounded-full bg-tn-gold-bg px-2.5 py-0.5 font-sans text-[10px] font-semibold tracking-[0.04em] text-tn-gold">
                PRIMARY
              </span>
            )}
          </div>
          <p className="m-0 truncate font-sans text-xs text-tn-muted-5">{location.address}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-tn-border-soft">
        {TABS.map((option) => {
          const isActive = tab === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => setTab(option.key)}
              aria-current={isActive ? "page" : undefined}
              className={`relative cursor-pointer border-none bg-transparent px-3 py-3 font-sans text-[13px] transition-colors duration-150 ${
                isActive
                  ? "font-semibold text-tn-ink"
                  : "font-medium text-tn-muted-5 hover:text-tn-ink-soft"
              }`}
            >
              {option.label}
              {/* Own element rather than a border on the button, so it can
                  animate its width in from the left — a border-bottom can
                  only fade. Keyed by tab so it replays on every switch. */}
              {isActive && (
                <span
                  key={tab}
                  aria-hidden
                  className="tn-underline-in absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-tn-ink"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Keyed by tab so each switch remounts this subtree and replays the
          fade-and-rise. Switching location remounts the whole panel (see
          LocationsPage's key on it), which replays it too. */}
      <div key={tab} className="tn-content-in pt-5">
        {tab === "details" && (
          <DetailsTab
            location={location}
            canManage={canManage}
            accessToken={accessToken ?? ""}
            onSaved={() => void queryClient.invalidateQueries({ queryKey: ["locations"] })}
          />
        )}
        {tab === "availability" && <LocationAvailabilityTab location={location} />}
        {tab === "staff" && <LocationStaffTab location={location} />}
        {tab === "services" && <LocationServicesTab location={location} canManage={canManage} />}
        {tab === "payouts" && <LocationPayoutsTab location={location} />}
      </div>
    </div>
  );
}

/** The mockup's Details tab: the location's own fields on the left, today's numbers and the booking link on the right. */
function DetailsTab({
  location,
  canManage,
  accessToken,
  onSaved,
}: {
  location: AccountLocation;
  canManage: boolean;
  accessToken: string;
  onSaved: () => void;
}) {
  const [name, setName] = useState(location.name);
  const [address, setAddress] = useState(location.address);
  const [phone, setPhone] = useState(location.phone ?? "");
  const [timezone, setTimezone] = useState(location.timezone ?? "");
  const [latitude, setLatitude] = useState(location.latitude);
  const [longitude, setLongitude] = useState(location.longitude);
  const [active, setActive] = useState(location.status === "active");
  const [error, setError] = useState<string | null>(null);
  const [geolocating, setGeolocating] = useState(false);
  /** Reverse-geocoded address for the current pin, offered as a suggestion rather than written into ADDRESS. */
  const [pinAddress, setPinAddress] = useState<string | null>(null);
  const pinRequest = useRef(0);

  // Re-seeded whenever the selected location changes — the panel stays
  // mounted while you click between shops in the list beside it.
  useEffect(() => {
    setName(location.name);
    setAddress(location.address);
    setPhone(location.phone ?? "");
    setTimezone(location.timezone ?? "");
    setLatitude(location.latitude);
    setLongitude(location.longitude);
    setActive(location.status === "active");
    setError(null);
  }, [location]);

  const save = useMutation({
    mutationFn: () =>
      updateLocation(accessToken, location.id, {
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim() ? phone.trim() : null,
        timezone: timezone.trim() ? timezone.trim() : null,
        latitude,
        longitude,
        status: active ? "active" : "inactive",
      }),
    onSuccess: () => {
      setError(null);
      onSaved();
    },
    onError: (err: unknown) =>
      setError(err instanceof Error ? err.message : "Couldn't save this location"),
  });

  /**
   * A map-search result was picked. Moves the pin only — ADDRESS is the
   * owner's to write, and this panel always has one already (a saved
   * location can't exist without it), so there's never a blank worth
   * prefilling here.
   */
  function onSearchSelected(result: GeocodeResult) {
    pinRequest.current++;
    setLatitude(result.latitude);
    setLongitude(result.longitude);
    setPinAddress(null);
    setError(null);
  }

  /**
   * Dragging the pin *offers* the nearest address rather than writing it
   * — newest response wins, same guard as the Add sheet. It used to
   * overwrite ADDRESS outright, which is how a shop on Valencia Town Main
   * Boulevard ended up stored as "Lahore, Punjab, Pakistan": accurate for
   * the pin, no use to a customer trying to find the door.
   */
  async function onPinMoved(nextLat: number, nextLng: number) {
    setLatitude(nextLat);
    setLongitude(nextLng);
    const request = ++pinRequest.current;
    try {
      const { displayName } = await reverseGeocodeLocation(accessToken, nextLat, nextLng);
      if (request === pinRequest.current) setPinAddress(displayName);
    } catch {
      // A failed reverse lookup just leaves the address as typed — the pin
      // still moved, which is the part the owner asked for.
    }
  }

  /**
   * Same "use my location" affordance as the Add sheet — see that file
   * for why the secure-context check and the per-code messages matter.
   */
  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setError("This browser can't share a location — drop the pin by hand instead.");
      return;
    }
    if (!window.isSecureContext) {
      setError("Location sharing needs a secure (https) connection — drop the pin by hand.");
      return;
    }
    setGeolocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeolocating(false);
        void onPinMoved(position.coords.latitude, position.coords.longitude);
      },
      (geoError) => {
        setGeolocating(false);
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setError(
            "Location access was blocked. Allow it in your browser's site settings, or drop the pin by hand.",
          );
        } else if (geoError.code === geoError.TIMEOUT) {
          setError("Locating took too long — try again, or drop the pin by hand.");
        } else {
          setError("Couldn't determine your location — drop the pin by hand.");
        }
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  }

  const canSave =
    canManage && name.trim().length > 0 && address.trim().length > 0 && isPhoneValid(phone);
  const bookingUrl = bookingUrlFor(location);

  return (
    <div className="flex flex-col gap-5">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={!canSave || save.isPending}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-5">
        <div className="flex min-w-[320px] flex-1 flex-col gap-4">
          <div className="flex flex-wrap gap-4">
            <div className="min-w-[180px] flex-1">
              <Field label="NAME">
                <input
                  type="text"
                  value={name}
                  disabled={!canManage}
                  onChange={(e) => setName(e.target.value)}
                  className={formInputClass}
                />
              </Field>
            </div>
            <div className="min-w-[180px] flex-1">
              <Field label="PHONE">
                <PhoneInput value={phone} onChange={setPhone} />
              </Field>
            </div>
          </div>

          {/*
            Two fields on purpose. ADDRESS is what's stored and what a
            customer reads; the search box below only moves the pin.
          */}
          <Field label="ADDRESS">
            <input
              type="text"
              value={address}
              disabled={!canManage}
              onChange={(e) => setAddress(e.target.value)}
              className={formInputClass}
            />
          </Field>

          <Field label="FIND ON MAP">
            <MapSearchField
              onSelect={onSearchSelected}
              disabled={!canManage}
              proximity={
                latitude != null && longitude != null ? { latitude, longitude } : undefined
              }
            />
          </Field>

          <LocationMapPicker latitude={latitude} longitude={longitude} onChange={onPinMoved} />

          {pinAddress && pinAddress !== address && (
            <div className="flex items-center gap-2 rounded-lg bg-tn-page px-3 py-2">
              <span className="flex-1 font-sans text-xs text-tn-muted-4">
                Nearest address here: {pinAddress}
              </span>
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0"
                disabled={!canManage}
                onClick={() => {
                  setAddress(pinAddress);
                  setPinAddress(null);
                }}
              >
                Use it
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <span className="font-sans text-xs text-tn-muted-5">
              Click the map or drag the pin to move it. The address above stays as you wrote it.
            </span>
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={useMyLocation}
              disabled={!canManage || geolocating}
            >
              {geolocating ? "Locating…" : "◎ Use my location"}
            </Button>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="min-w-[180px] flex-1">
              <Field label="TIMEZONE">
                <TimezonePicker
                  value={timezone}
                  onChange={setTimezone}
                  placeholder="Not set — bookings read in UTC"
                  // Sized to sit level with BOOKING STATUS beside it and
                  // the NAME/ADDRESS inputs above — the default trigger is
                  // the compact chip from the availability header.
                  className={`w-full !justify-between !rounded-xl !px-3.5 !text-sm !font-normal ${formControlHeightClass}`}
                />
              </Field>
            </div>
            <div className="min-w-[180px] flex-1">
              <Field label="BOOKING STATUS">
                <div
                  className={`flex items-center justify-between gap-3 rounded-xl border border-tn-input-border px-3.5 py-2.5 ${formControlHeightClass}`}
                >
                  <span className="font-sans text-sm text-tn-ink">
                    {active ? "Taking bookings" : "Not taking bookings"}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={active}
                    aria-label="Taking bookings"
                    disabled={!canManage || location.isPrimary}
                    onClick={() => setActive((v) => !v)}
                    className={`relative h-[22px] w-9 flex-none cursor-pointer rounded-full border-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      active ? "bg-tn-success" : "bg-tn-border-softer"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-[18px] w-[18px] rounded-full bg-tn-surface transition-transform ${
                        active ? "translate-x-[14px]" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </Field>
              {location.isPrimary && (
                <p className="m-0 pt-1 font-sans text-[11px] text-tn-muted-5">
                  Your primary location can&rsquo;t stop taking bookings.
                </p>
              )}
            </div>
          </div>

          {error && <p className="m-0 font-sans text-sm text-tn-danger">{error}</p>}
        </div>

        <div className="flex w-full max-w-[280px] flex-col gap-3">
          <div className="flex flex-col gap-3 rounded-2xl border border-tn-border px-4 py-3.5">
            <p className="m-0 font-sans text-xs font-semibold text-tn-ink">
              Today at {location.name}
            </p>
            <div className="flex gap-4">
              <Figure value={String(location.bookingsToday)} label="Bookings" />
              <Figure value={money(location.revenueTodayCents)} label="Revenue" />
              <Figure value={String(location.staffCount)} label="Staff" />
            </div>
            <p className="m-0 font-sans text-[11px] text-tn-faint">
              {location.slotsCapacity > 0
                ? `${location.slotsBooked} of ${location.slotsCapacity} half-hour slots booked`
                : "No working hours set — nothing is bookable here yet"}
            </p>
          </div>

          <BookingLinkCard location={location} url={bookingUrl} />
        </div>
      </div>
    </div>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-sans text-[15px] font-semibold text-tn-ink">{value}</span>
      <span className="font-sans text-[10px] text-tn-muted-5">{label}</span>
    </div>
  );
}

/**
 * The mockup's "Booking link & QR" card.
 *
 * Shows the real code when there's somewhere for it to point, and says so
 * plainly when there isn't — a printed QR that resolves to nothing is
 * worse than no QR, and the public page this would target doesn't exist
 * yet.
 */
function BookingLinkCard({ location, url }: { location: AccountLocation; url: string | null }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!url) {
      setSvg(null);
      return;
    }
    let cancelled = false;
    QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 1, width: 132 })
      .then((markup) => {
        if (!cancelled) setSvg(markup);
      })
      .catch(() => {
        if (!cancelled) setSvg(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `${location.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-booking-qr.svg`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-tn-border px-4 py-3.5">
      <p className="m-0 font-sans text-xs font-semibold text-tn-ink">Booking link &amp; QR</p>
      {url === null ? (
        <p className="m-0 font-sans text-[11px] leading-relaxed text-tn-muted-5">
          No public booking page is configured yet, so there&rsquo;s nothing for a code to point at.
          Set <code className="font-mono text-[10px]">VITE_BOOKING_BASE_URL</code> once that page
          exists.
        </p>
      ) : (
        <>
          {svg && (
            <div
              className="h-[132px] w-[132px] [&>svg]:h-full [&>svg]:w-full"
              aria-label={`Booking QR code for ${location.name}`}
              // The library returns a complete, self-contained <svg> string.
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          )}
          <span className="font-sans text-[11px] break-all text-tn-muted-5">{url}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button variant="secondary" size="sm" onClick={download} disabled={!svg}>
              Download QR
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default LocationDetailPanel;
