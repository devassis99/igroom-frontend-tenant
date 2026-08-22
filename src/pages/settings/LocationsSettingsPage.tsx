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

      {locations.length > 0 && (
        <div
          className="overflow-x-auto rounded-2xl border border-tn-border"
          style={{ maxWidth: 960 }}
        >
          <table className="w-full border-collapse font-sans">
            <thead>
              <tr className="border-b border-tn-border-softer bg-tn-table-head">
                <th className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold text-tn-muted-5">
                  Location
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-tn-muted-5">
                  Address
                </th>
                <th className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold text-tn-muted-5">
                  Staff
                </th>
                <th className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold text-tn-muted-5">
                  Bookings today
                </th>
                <th className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold text-tn-muted-5">
                  Revenue
                </th>
                <th className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold text-tn-muted-5">
                  Waitlist
                </th>
                {canManageLocations && <th className="w-10 px-5 py-3" aria-hidden="true" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-tn-border-soft">
              {locations.map((loc) => (
                <tr key={loc.id}>
                  <td
                    className="whitespace-nowrap px-5 py-3.5"
                    aria-label={`${loc.name} — ${loc.status === "active" ? "Active" : "Inactive"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-sans text-[13px] font-semibold text-tn-ink">
                        {loc.name}
                      </span>
                      <StatusPill tone={loc.status === "active" ? "success" : "neutral"}>
                        {loc.status === "active" ? "Active" : "Inactive"}
                      </StatusPill>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-tn-muted-5">
                    <div className="max-w-[280px] truncate" title={loc.address}>
                      {loc.address}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-xs font-medium text-tn-ink">
                    {loc.staffCount}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-xs font-medium text-tn-ink">
                    {loc.bookingsToday}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-xs font-medium text-tn-ink">
                    ${(loc.revenueTodayCents / 100).toFixed(0)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5">
                    <button
                      type="button"
                      onClick={() => setQrLocation(loc)}
                      className="flex cursor-pointer items-center gap-1.5 border-none bg-transparent font-sans text-xs font-medium text-tn-gold"
                    >
                      🔑 QR Code
                    </button>
                  </td>
                  {canManageLocations && (
                    <td className="whitespace-nowrap px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleEdit(loc)}
                        aria-label={`Edit ${loc.name}`}
                        title="Edit location"
                        className="cursor-pointer border-none bg-transparent p-0 font-sans text-tn-muted-5"
                      >
                        ✎
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
