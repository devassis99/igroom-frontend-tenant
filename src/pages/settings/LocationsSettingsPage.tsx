import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { QrCodeModal } from "@/components/settings/QrCodeModal";
import { AddEditLocationModal } from "@/components/settings/AddEditLocationModal";
import {
  RevenueSparkline,
  StaffStack,
  UtilisationCell,
} from "@/components/settings/LocationRowMetrics";
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

/** Grid track widths shared by the header row and every body row, so the two can't drift apart. */
const ROW_GRID = "minmax(180px,2fr) minmax(150px,1.6fr) 92px 132px 140px 150px";

type Filter = "all" | "active" | "needs-setup";

/**
 * The ops table from the Locations mockup (1c/1d): status as a coloured
 * left edge rather than a pill, a roster avatar stack, today's
 * utilisation, and a week of takings as a sparkline — every column backed
 * by real data from listLocations.
 *
 * Add and Edit open a side sheet rather than a centred modal so the list
 * stays on screen: you can see the row you're changing, and the locations
 * you might copy hours or services from.
 */
export function LocationsSettingsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { has: hasPermission } = usePermissions();

  const [qrLocation, setQrLocation] = useState<AccountLocation | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<AccountLocation | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: () => listLocations(accessToken ?? ""),
    enabled: !!accessToken,
  });
  const locations = locationsQuery.data?.locations ?? EMPTY_LOCATIONS;

  const canManageLocations = hasPermission("locations.manage");
  const usedSeats = locations.reduce((sum, loc) => sum + loc.staffCount, 0);

  const counts = useMemo(
    () => ({
      all: locations.length,
      active: locations.filter((loc) => loc.status === "active" && !loc.needsSetup).length,
      "needs-setup": locations.filter((loc) => loc.needsSetup).length,
    }),
    [locations],
  );

  const visible = useMemo(() => {
    if (filter === "active") {
      return locations.filter((loc) => loc.status === "active" && !loc.needsSetup);
    }
    if (filter === "needs-setup") return locations.filter((loc) => loc.needsSetup);
    return locations;
  }, [locations, filter]);

  function openAdd() {
    setEditingLocation(null);
    setSheetOpen(true);
  }

  function openEdit(loc: AccountLocation) {
    setEditingLocation(loc);
    setSheetOpen(true);
  }

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "needs-setup", label: "Needs setup" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 font-sans text-2xl font-semibold text-tn-ink">Locations</h1>
          <p className="m-0 font-sans text-xs text-tn-muted-5">
            {locations.length} location{locations.length === 1 ? "" : "s"} · {usedSeats} of{" "}
            {TOTAL_SEATS} seats used · Business Plan · $12/seat/mo, billed per location
          </p>
        </div>
        {canManageLocations && <Button onClick={openAdd}>+ Add Location</Button>}
      </div>

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
        <>
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((option) => {
              const isActive = filter === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setFilter(option.key)}
                  aria-pressed={isActive}
                  className={`cursor-pointer rounded-full px-3.5 py-1.5 font-sans text-xs ${
                    isActive
                      ? "border-none bg-tn-dark font-semibold text-tn-on-dark"
                      : "border border-tn-input-border bg-transparent font-medium text-tn-ink-soft hover:bg-tn-page"
                  }`}
                >
                  {option.label} ({counts[option.key]})
                </button>
              );
            })}
            <div className="flex-1" />
            {/*
              A label, not a control: the sparkline's window is fixed at
              seven days server-side, and a dropdown offering ranges the
              API can't honour would be a lie about what the page can do.
            */}
            <span className="font-sans text-xs text-tn-muted-5">Revenue · last 7 days</span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-tn-border">
            <div style={{ minWidth: 900 }}>
              <div
                style={{ gridTemplateColumns: ROW_GRID }}
                className="grid items-center gap-3.5 border-b border-tn-border-softer bg-tn-table-head py-3 pr-4 pl-[19px]"
              >
                <span className="font-sans text-[11px] font-semibold tracking-[0.05em] text-tn-muted-5">
                  LOCATION
                </span>
                <span className="font-sans text-[11px] font-semibold tracking-[0.05em] text-tn-muted-5">
                  ADDRESS
                </span>
                <span className="font-sans text-[11px] font-semibold tracking-[0.05em] text-tn-muted-5">
                  STAFF
                </span>
                <span className="font-sans text-[11px] font-semibold tracking-[0.05em] text-tn-muted-5">
                  TODAY
                </span>
                <span className="font-sans text-[11px] font-semibold tracking-[0.05em] text-tn-muted-5">
                  REVENUE · 7D
                </span>
                <span className="text-right font-sans text-[11px] font-semibold tracking-[0.05em] text-tn-muted-5">
                  ACTIONS
                </span>
              </div>

              {visible.map((loc, index) => (
                <div
                  key={loc.id}
                  style={{
                    gridTemplateColumns: ROW_GRID,
                    // The status edge: gold while a location still needs
                    // setting up, green once it can actually take a
                    // booking, muted when deactivated. Replaces the pill,
                    // which cost a whole column to say one word.
                    borderLeftColor: loc.needsSetup
                      ? "var(--color-tn-gold)"
                      : loc.status === "active"
                        ? "var(--color-tn-success)"
                        : "var(--color-tn-border)",
                  }}
                  className={`group grid items-center gap-3.5 border-l-[3px] py-3.5 pr-4 pl-4 hover:bg-tn-page ${
                    index < visible.length - 1 ? "border-b border-tn-border-soft" : ""
                  }`}
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-sans text-[13px] font-semibold text-tn-ink">
                      {loc.name}
                    </span>
                    <span
                      className={`truncate font-sans text-[11px] ${
                        loc.needsSetup ? "text-tn-gold" : "text-tn-muted-5"
                      }`}
                    >
                      {loc.needsSetup
                        ? loc.staffCount === 0
                          ? "Needs staff & hours"
                          : "Needs working hours"
                        : [loc.isPrimary ? "Primary" : null, loc.timezone]
                            .filter(Boolean)
                            .join(" · ")}
                    </span>
                  </div>

                  <span className="truncate font-sans text-xs text-tn-muted-5" title={loc.address}>
                    {loc.address}
                  </span>

                  <StaffStack location={loc} />
                  <UtilisationCell location={loc} />
                  <RevenueSparkline location={loc} />

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setQrLocation(loc)}
                      aria-label={`QR code for ${loc.name}`}
                      className="cursor-pointer rounded-lg border border-tn-input-border bg-transparent px-2.5 py-1.5 font-sans text-[11px] font-semibold text-tn-ink-soft hover:bg-tn-surface"
                    >
                      QR
                    </button>
                    {canManageLocations &&
                      (loc.needsSetup ? (
                        <Button size="sm" onClick={() => openEdit(loc)}>
                          Finish setup
                        </Button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openEdit(loc)}
                          aria-label={`Edit ${loc.name}`}
                          className="cursor-pointer rounded-lg border border-tn-input-border bg-transparent px-2.5 py-1.5 font-sans text-[11px] font-semibold text-tn-ink-soft hover:bg-tn-surface"
                        >
                          Edit
                        </button>
                      ))}
                  </div>
                </div>
              ))}

              {visible.length === 0 && (
                <p className="m-0 px-4 py-6 text-center font-sans text-sm text-tn-muted-5">
                  No locations match this filter.
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {!locationsQuery.isPending && locations.length === 0 && (
        <p className="m-0 font-sans text-sm text-tn-muted-5">
          No locations yet — add your first one.
        </p>
      )}

      <QrCodeModal location={qrLocation} onClose={() => setQrLocation(null)} />
      <AddEditLocationModal
        open={sheetOpen}
        location={editingLocation}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
}

export default LocationsSettingsPage;
