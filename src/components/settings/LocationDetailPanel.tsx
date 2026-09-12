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
import { LocationGalleryTab } from "@/components/settings/location-tabs/LocationGalleryTab";
import { useAuthStore } from "@/auth/auth-store";
import {
  reverseGeocodeLocation,
  type GeocodeResult,
  updateLocation,
  type AccountLocation,
} from "@/lib/locations-api";
import { Toggle } from "@/components/ui/Toggle";
import { usePermissions } from "@/auth/use-permissions";
import {
  branchBookingUrl,
  shopLinkOpensBranch,
  displayUrl,
  hasOwnBranchLink,
  publicBookingUrl,
} from "@/lib/public-link";

const TABS = [
  { key: "details", label: "Details" },
  { key: "availability", label: "Availability" },
  { key: "staff", label: "Staff" },
  { key: "services", label: "Services & pricing" },
  { key: "payouts", label: "Payouts" },
  // Last, after the takings: the gallery is the only tab that changes
  // what a stranger sees rather than how the shop runs, and it is the one
  // an owner visits once and then rarely again.
  { key: "gallery", label: "Gallery" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

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
  liveBranchCount,
}: {
  location: AccountLocation;
  canManage: boolean;
  /** Branches of this account whose public link is open — what the brand link has to choose between. */
  liveBranchCount: number;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const { account } = usePermissions();
  const [tab, setTab] = useState<TabKey>("details");
  // The account half of every public booking link. One value for the
  // whole business — the branch half is on the location itself.
  const accountSlug = account?.slug ?? null;

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
            liveBranchCount={liveBranchCount}
            accessToken={accessToken ?? ""}
            accountSlug={accountSlug}
            onSaved={() => void queryClient.invalidateQueries({ queryKey: ["locations"] })}
          />
        )}
        {tab === "availability" && <LocationAvailabilityTab location={location} />}
        {tab === "staff" && <LocationStaffTab location={location} canManage={canManage} />}
        {tab === "services" && <LocationServicesTab location={location} canManage={canManage} />}
        {tab === "payouts" && <LocationPayoutsTab location={location} />}
        {tab === "gallery" && <LocationGalleryTab location={location} canManage={canManage} />}
      </div>
    </div>
  );
}

/** The mockup's Details tab: the location's own fields on the left, today's numbers and the booking link on the right. */
function DetailsTab({
  location,
  canManage,
  liveBranchCount,
  accessToken,
  accountSlug,
  onSaved,
}: {
  location: AccountLocation;
  canManage: boolean;
  liveBranchCount: number;
  accessToken: string;
  /** The account's own half of every public link — fixed at signup, same for every branch. */
  accountSlug: string | null;
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
  const bookingUrl = branchBookingUrl(accountSlug, location);
  const shopUrl = publicBookingUrl(accountSlug);

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
              {/* An em dash where a figure would be: this branch isn't one
                  the caller runs, so its takings were never sent. */}
              <Figure
                value={location.bookingsToday === null ? "—" : String(location.bookingsToday)}
                label="Bookings"
              />
              <Figure
                value={
                  location.revenueTodayCents === null ? "—" : money(location.revenueTodayCents)
                }
                label="Revenue"
              />
              <Figure value={String(location.staffCount)} label="Staff" />
            </div>
            <p className="m-0 font-sans text-[11px] text-tn-faint">
              {location.slotsCapacity === null || location.slotsBooked === null
                ? "Today's figures are only shown for locations you manage"
                : location.slotsCapacity > 0
                  ? `${location.slotsBooked} of ${location.slotsCapacity} half-hour slots booked`
                  : "No working hours set — nothing is bookable here yet"}
            </p>
          </div>

          <BookingLinkCard
            location={location}
            url={bookingUrl}
            shopUrl={shopUrl}
            liveBranchCount={liveBranchCount}
            canManage={canManage}
            accessToken={accessToken}
            onSaved={onSaved}
          />
          <OnlineDepositCard
            location={location}
            canManage={canManage}
            accessToken={accessToken}
            onSaved={onSaved}
          />
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
 * worse than no QR.
 *
 * The link is now the shop's own slug rather than the location uuid it
 * used to be. That matters beyond tidiness: this string ends up in an
 * Instagram bio and on a Google listing, where it is read by people and
 * outlives anything we control. "igroom.io/thegentry" is something an
 * owner will happily paste and a customer can type off a poster; a uuid
 * is neither.
 */
/**
 * Whether a booking from the public link has to leave a deposit.
 *
 * Per branch, not per account, and off by default. Asking a stranger who
 * arrived from an Instagram bio for a card before they have ever sat in
 * the chair is the single most effective way to not get the booking —
 * but a shop that keeps getting stood up on a Saturday has the opposite
 * problem, and a busy high-street branch and a quiet suburban one don't
 * have the same one. So it is a switch, and the shop decides.
 *
 * Saved on its own rather than with the Details form's Save button: it
 * is a policy, not a detail, and somebody flipping it has not
 * necessarily finished editing the address.
 */
function OnlineDepositCard({
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
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (next: boolean) =>
      updateLocation(accessToken, location.id, { requireDepositOnline: next }),
    onSuccess: () => {
      setError(null);
      onSaved();
    },
    onError: (err: unknown) =>
      setError(err instanceof Error ? err.message : "Couldn’t save that — try again."),
  });

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-tn-border px-4 py-3.5">
      <p className="m-0 font-sans text-xs font-semibold text-tn-ink">Online bookings</p>
      {/* Toggle brings its own label row, so the consequence goes
          underneath rather than inside it — and it is written as what
          actually happens, not as the setting's name repeated. */}
      <Toggle
        checked={location.requireDepositOnline}
        disabled={!canManage || save.isPending}
        onChange={(next) => save.mutate(next)}
        label="Ask for a deposit"
      />
      <p className="m-0 font-sans text-[11px] leading-relaxed text-tn-muted-5">
        {location.requireDepositOnline
          ? "A card is taken before the slot is held. Fewer no-shows — and fewer bookings."
          : "Customers book with a name and a number, and pay at the shop."}
      </p>
      {error && <p className="m-0 font-sans text-[11px] text-tn-danger">{error}</p>}
    </div>
  );
}

function BookingLinkCard({
  location,
  url,
  shopUrl,
  liveBranchCount,
  canManage,
  accessToken,
  onSaved,
}: {
  location: AccountLocation;
  /** This branch's own link — the shop's bare link for the primary branch. */
  url: string | null;
  /** The shop's bare link, shown beside a branch link so the difference is visible. */
  shopUrl: string | null;
  /** How many branches of this account are open for bookings — see the brand-link line below. */
  liveBranchCount: number;
  canManage: boolean;
  accessToken: string;
  onSaved: () => void;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const enabled = location.onlineBookingEnabled;

  const setEnabled = useMutation({
    mutationFn: (next: boolean) =>
      updateLocation(accessToken, location.id, { onlineBookingEnabled: next }),
    // The switch lives on the location row this panel was handed, so the
    // locations list is what has to be refetched for the card to redraw.
    onSuccess: () => onSaved(),
  });

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
      <div className="flex flex-col gap-1">
        <p className="m-0 font-sans text-xs font-semibold text-tn-ink">Booking link &amp; QR</p>
        {/* Said plainly, because this is the one thing on the page an
            owner is meant to take somewhere else — into an Instagram
            bio, a Google listing, a WhatsApp reply. */}
        <p className="m-0 font-sans text-[11px] leading-relaxed text-tn-muted-5">
          Paste this anywhere customers find you. It opens your shop&rsquo;s booking page — no app
          and no account needed.
        </p>
      </div>

      {/* The switch sits with the link rather than on a settings page,
          because this is where somebody finds out the link doesn't work:
          they copy it, open it, get "shop not found", and come back
          here. The answer should be in the same card as the question.

          Per branch, and this is the card for one branch — the flagship
          can be live months before the new door across town, and a
          branch mid-refit can go dark without taking the others with
          it. */}
      <div className="flex flex-col gap-1.5 rounded-xl border border-tn-border-soft bg-tn-page px-3 py-2.5">
        <Toggle
          checked={enabled}
          disabled={!canManage || setEnabled.isPending}
          onChange={(next) => setEnabled.mutate(next)}
          label="Take bookings from this link"
        />
        <p className="m-0 font-sans text-[11px] leading-relaxed text-tn-muted-5">
          {enabled
            ? `${location.name} is taking bookings from this link. Your other branches have their own switch.`
            : "This branch’s page is off, so the link below won’t open for anyone yet. Turn it on when its services and hours are ready."}
        </p>
        {setEnabled.isError && (
          <p className="m-0 font-sans text-[11px] text-tn-danger">
            Couldn&rsquo;t save that — try again.
          </p>
        )}
      </div>
      {url === null ? (
        <p className="m-0 font-sans text-[11px] leading-relaxed text-tn-muted-5">
          No public booking site is configured yet, so there&rsquo;s nothing for a link or a code to
          point at. Set <code className="font-mono text-[10px]">VITE_BOOKING_BASE_URL</code>.
        </p>
      ) : (
        <>
          {/* The link itself, big enough to read back off the screen —
              somebody dictating it over the phone is a real thing that
              happens, and it is why the URL is words rather than a uuid. */}
          <div className="flex items-center justify-between gap-2 rounded-xl border border-tn-input-border bg-tn-page px-3 py-2.5">
            <span className="min-w-0 flex-1 font-mono text-[11.5px] break-all text-tn-ink">
              {displayUrl(url)}
            </span>
            <Button variant="secondary" size="sm" onClick={copy} className="flex-none">
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>

          {/* The shop's bare link, named underneath rather than offered
              as the headline. For the primary branch it is a second way
              into this same page and worth having — it is the string
              that fits on a poster; for any other branch it is where
              somebody lands if they hand out the wrong one. Either way
              the link above is the one that says which door it opens. */}
          {hasOwnBranchLink(location) && shopUrl ? (
            <p className="m-0 font-sans text-[11px] leading-relaxed text-tn-muted-5">
              This link opens {location.name} directly.{" "}
              <span className="font-mono text-[11px] text-tn-ink-soft">{displayUrl(shopUrl)}</span>{" "}
              {shopLinkOpensBranch(location)
                ? "is the short version of it — the one to put on a poster."
                : "opens your main branch."}
            </p>
          ) : null}

          {/* What the *brand* link does, which is the one thing about it
              an owner cannot work out from the branch in front of them.
              It changes shape at two branches — one live branch and the
              short link is that shop; two and it becomes a chooser — and
              until this line existed the only way to find out was to open
              it in a private window. */}
          {shopUrl ? (
            <p
              className={`m-0 font-sans text-[11px] leading-relaxed ${
                liveBranchCount === 0 ? "text-tn-gold" : "text-tn-muted-5"
              }`}
            >
              <span className="font-mono text-[11px] text-tn-ink-soft">{displayUrl(shopUrl)}</span>{" "}
              {liveBranchCount === 0
                ? "opens nothing at the moment — no branch is taking bookings from its link."
                : liveBranchCount === 1
                  ? "goes straight to the one branch that’s live. Switch on a second and it becomes a “choose a shop” page."
                  : `shows a “choose a shop” page — ${liveBranchCount} branches are live on it.`}
            </p>
          ) : null}

          {svg && (
            <div
              className="h-[132px] w-[132px] [&>svg]:h-full [&>svg]:w-full"
              aria-label={`Booking QR code for ${location.name}`}
              // The library returns a complete, self-contained <svg> string.
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          )}
          <div className="flex gap-2">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-tn-input-border bg-tn-surface px-3.5 py-2 font-sans text-xs font-semibold text-tn-ink no-underline hover:bg-tn-page"
            >
              Open page
            </a>
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
