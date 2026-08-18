import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { QrCodeModal } from "@/components/settings/QrCodeModal";
import { AddEditLocationModal } from "@/components/settings/AddEditLocationModal";
import { useAuthStore } from "@/auth/auth-store";
import { usePermissions } from "@/auth/use-permissions";
import { listLocations, type AccountLocation } from "@/lib/locations-api";

// Stable empty-array fallback — see CalendarPage.tsx's identical comment on why a fresh `[]` literal per render would defeat memoization downstream.
const EMPTY_LOCATIONS: AccountLocation[] = [];

// No account-level subscription/seats endpoint exists yet (getMe's
// `account` field is untyped — see accounts-api.ts's MeResponse comment),
// so unlike the location count/stats below (all real), the seat cap and
// per-seat price here stay the mockup's illustrative numbers. Revisit
// once a real GET for the account's active plan/seat usage exists.
const TOTAL_SEATS = 8;

/** Matches the mockup's T12d Locations page + T12d2 QR code modal, now backed by real igroom-backend data (see locations-api.ts) instead of a static list. */
export function LocationsSettingsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { has: hasPermission } = usePermissions();

  const [qrLocation, setQrLocation] = useState<AccountLocation | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<AccountLocation | null>(null);

  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: () => listLocations(accessToken ?? ""),
    enabled: !!accessToken,
  });
  const locations = locationsQuery.data?.locations ?? EMPTY_LOCATIONS;

  const canManageLocations = hasPermission("locations.manage");
  const usedSeats = locations.reduce((sum, loc) => sum + loc.staffCount, 0);

  function handleAdd() {
    setEditingLocation(null);
    setModalOpen(true);
  }

  function handleEdit(loc: AccountLocation) {
    setEditingLocation(loc);
    setModalOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="m-0 font-sans text-2xl font-semibold text-tn-ink">Locations</h1>
        {canManageLocations && <Button onClick={handleAdd}>+ Add Location</Button>}
      </div>
      <p className="m-0 -mt-3 font-sans text-xs text-tn-muted-5">
        {locations.length} location{locations.length === 1 ? "" : "s"} · {usedSeats} of{" "}
        {TOTAL_SEATS} seats used · Business Plan · $12/seat/mo, billed per location
      </p>

      {locationsQuery.isError && (
        <p className="m-0 font-sans text-sm text-tn-danger">
          Couldn&rsquo;t load your locations right now (
          {locationsQuery.error instanceof Error ? locationsQuery.error.message : "unknown error"})
          — refresh to try again.
        </p>
      )}
      {locationsQuery.isPending && (
        <p className="m-0 font-sans text-sm text-tn-muted-5">Loading your locations…</p>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2" style={{ maxWidth: 720 }}>
        {locations.map((loc) => (
          <div key={loc.id} className="flex flex-col gap-3 rounded-2xl border border-tn-border p-5">
            <div className="flex items-start justify-between gap-2">
              <p className="m-0 font-sans text-base font-semibold text-tn-ink">{loc.name}</p>
              <div className="flex items-center gap-2">
                <StatusPill tone={loc.status === "active" ? "success" : "neutral"}>
                  {loc.status === "active" ? "Active" : "Inactive"}
                </StatusPill>
                {canManageLocations && (
                  <button
                    type="button"
                    onClick={() => handleEdit(loc)}
                    aria-label={`Edit ${loc.name}`}
                    title="Edit location"
                    className="cursor-pointer border-none bg-transparent p-0 font-sans text-tn-muted-5"
                  >
                    ✎
                  </button>
                )}
              </div>
            </div>
            <p className="m-0 font-sans text-xs text-tn-muted-5">{loc.address}</p>
            <div className="flex gap-6 font-sans text-xs text-tn-muted-4">
              <span>
                Staff <strong className="text-tn-ink">{loc.staffCount}</strong>
              </span>
              <span>
                Bookings today <strong className="text-tn-ink">{loc.bookingsToday}</strong>
              </span>
              <span>
                Revenue{" "}
                <strong className="text-tn-ink">${(loc.revenueTodayCents / 100).toFixed(0)}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setQrLocation(loc)}
              className="flex w-fit cursor-pointer items-center gap-1.5 border-none bg-transparent font-sans text-xs font-medium text-tn-gold"
            >
              🔑 View Waitlist QR Code
            </button>
          </div>
        ))}
      </div>

      {!locationsQuery.isPending && locations.length === 0 && (
        <p className="m-0 font-sans text-sm text-tn-muted-5">
          No locations yet — add your first one.
        </p>
      )}

      <QrCodeModal location={qrLocation} onClose={() => setQrLocation(null)} />
      <AddEditLocationModal
        open={modalOpen}
        location={editingLocation}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}

export default LocationsSettingsPage;
