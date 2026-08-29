import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { QrCodeModal } from "@/components/settings/QrCodeModal";
import { AddEditLocationModal } from "@/components/settings/AddEditLocationModal";
import { LocationDetailPanel } from "@/components/settings/LocationDetailPanel";
import {
  RevenueSparkline,
  StaffStack,
  UtilisationCell,
} from "@/components/settings/LocationRowMetrics";
import { useAppChrome } from "@/components/layout/AppShell";
import { useAuthStore } from "@/auth/auth-store";
import { usePermissions } from "@/auth/use-permissions";
import { listLocations, type AccountLocation } from "@/lib/locations-api";
import { listCollisions } from "@/lib/collisions-api";

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

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "needs-setup", label: "Needs setup" },
];

/** The coloured left edge, and the same dot in the detail view's list. Gold = unfinished, green = bookable, grey = switched off. */
function statusColour(loc: AccountLocation): string {
  if (loc.needsSetup) return "var(--color-tn-gold)";
  return loc.status === "active" ? "var(--color-tn-success)" : "var(--color-tn-border)";
}

/**
 * Two views of the same data, from the Locations mockup.
 *
 * The ops table (frames 1c/1d) is the overview: status as a coloured left
 * edge rather than a pill, a roster avatar stack, today's utilisation and
 * a week of takings, every column real. Clicking a row opens frame 1b —
 * the list-plus-detail pane, where one shop's hours, roster, menu and
 * takings live together. The table answers "how are my shops doing"; the
 * pane answers "what is going on at this one", and neither is a good way
 * to ask the other question.
 */
export function LocationsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { has: hasPermission } = usePermissions();
  const { setNavCollapsed } = useAppChrome();

  const [qrLocation, setQrLocation] = useState<AccountLocation | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<AccountLocation | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: () => listLocations(accessToken ?? ""),
    enabled: !!accessToken,
  });
  const locations = locationsQuery.data?.locations ?? EMPTY_LOCATIONS;

  /**
   * Standing collisions, account-wide, from the nightly sweep.
   *
   * Read here rather than per row so the whole list costs one request,
   * and shown as a badge on the shops involved because that is where an
   * owner is already looking when they wonder whether a branch is
   * healthy — the same place "Needs working hours" lives. Failing quietly
   * on purpose: a locations list that won't render because a warning
   * endpoint is down is worse than one showing no warnings.
   */
  const collisionsQuery = useQuery({
    queryKey: ["collisions"],
    queryFn: () => listCollisions(accessToken ?? ""),
    enabled: !!accessToken,
    staleTime: 60_000,
    retry: false,
  });

  /** locationId -> how many findings name it. A clash names two shops and is counted against both, because either one is a place to go and fix it. */
  const collisionsByLocation = useMemo(() => {
    const counts = new Map<string, number>();
    for (const finding of collisionsQuery.data?.findings ?? []) {
      for (const id of [finding.locationAId, finding.locationBId]) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return counts;
  }, [collisionsQuery.data]);

  const canManageLocations = hasPermission("locations.manage");
  const usedSeats = locations.reduce((sum, loc) => sum + loc.staffCount, 0);

  // Held by id, not by value: the list refetches after every save, and a
  // captured object would leave the pane showing the pre-save copy.
  const selected = selectedId ? (locations.find((loc) => loc.id === selectedId) ?? null) : null;

  // Leaving the page entirely (or the location going away) must not strand
  // the nav collapsed on the next settings screen.
  useEffect(() => () => setNavCollapsed(false), [setNavCollapsed]);

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

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter(
      (loc) => loc.name.toLowerCase().includes(q) || loc.address.toLowerCase().includes(q),
    );
  }, [locations, search]);

  function openAdd() {
    setEditingLocation(null);
    setSheetOpen(true);
  }

  /** Selecting a shop collapses the settings nav — the pane wants the width, and the nav isn't what you're looking at once you're inside one location. */
  function openDetail(loc: AccountLocation) {
    setSelectedId(loc.id);
    setNavCollapsed(true);
  }

  function backToTable() {
    setSelectedId(null);
    setNavCollapsed(false);
  }

  if (selected) {
    return (
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={backToTable}
          className="w-fit cursor-pointer border-none bg-transparent p-0 font-sans text-xs font-semibold text-tn-muted-5 transition-colors duration-150 hover:text-tn-ink"
        >
          &larr; All locations
        </button>

        <div className="flex flex-wrap items-start gap-6">
          <aside className="flex w-[260px] flex-none flex-col gap-3">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search locations"
              aria-label="Search locations"
              className="rounded-xl border border-tn-input-border bg-tn-surface px-3 py-2 font-sans text-[13px] text-tn-ink outline-none focus:border-tn-gold placeholder:text-tn-placeholder"
            />

            <div className="flex flex-col gap-1.5">
              {searched.map((loc) => {
                const isSelected = loc.id === selected.id;
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => setSelectedId(loc.id)}
                    aria-current={isSelected ? "true" : undefined}
                    className={`flex cursor-pointer flex-col gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors duration-150 ${
                      isSelected
                        ? "border-tn-border bg-tn-page"
                        : "border-transparent bg-transparent hover:bg-tn-page"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        style={{ backgroundColor: statusColour(loc) }}
                        className="h-2 w-2 flex-none rounded-full"
                      />
                      <span className="truncate font-sans text-[13px] font-semibold text-tn-ink">
                        {loc.name}
                      </span>
                    </span>
                    <span className="truncate font-sans text-[11px] text-tn-muted-5">
                      {loc.address}
                    </span>
                    <span className="font-sans text-[11px] text-tn-faint">
                      {loc.needsSetup
                        ? loc.staffCount === 0
                          ? "No staff · setup incomplete"
                          : "No hours · setup incomplete"
                        : loc.bookingsToday === null
                          ? // Not a branch this caller runs, so today's
                            // count was never sent — say nothing about it
                            // rather than imply a quiet day.
                            `${loc.staffCount} staff${loc.isPrimary ? " · Primary" : ""}`
                          : `${loc.staffCount} staff · ${loc.bookingsToday} booking${
                              loc.bookingsToday === 1 ? "" : "s"
                            } today${loc.isPrimary ? " · Primary" : ""}`}
                    </span>
                  </button>
                );
              })}
              {searched.length === 0 && (
                <p className="m-0 px-3 py-4 font-sans text-xs text-tn-muted-5">
                  No locations match &ldquo;{search}&rdquo;.
                </p>
              )}
            </div>

            {canManageLocations && (
              <button
                type="button"
                onClick={openAdd}
                className="cursor-pointer rounded-xl border border-dashed border-tn-border bg-transparent px-3 py-2.5 font-sans text-[13px] font-semibold text-tn-ink-soft hover:bg-tn-page"
              >
                + Add location
              </button>
            )}

            <div className="flex flex-col gap-1.5 rounded-xl bg-tn-page px-3 py-2.5">
              <span className="font-sans text-[11px] font-semibold text-tn-ink">
                {usedSeats} of {TOTAL_SEATS} seats used
              </span>
              <span className="h-1.5 w-full overflow-hidden rounded-full bg-tn-border-softer">
                <span
                  style={{ width: `${Math.min(100, (usedSeats / TOTAL_SEATS) * 100)}%` }}
                  className="block h-full rounded-full bg-tn-success"
                />
              </span>
            </div>
          </aside>

          {/* Keyed by id so picking a different shop remounts the pane:
              the content animates in rather than mutating field by field,
              and the tab resets to Details instead of leaving you on, say,
              Payouts for a location you just opened. */}
          <LocationDetailPanel
            key={selected.id}
            location={selected}
            canManage={canManageLocations}
          />
        </div>

        <QrCodeModal location={qrLocation} onClose={() => setQrLocation(null)} />
        <AddEditLocationModal
          open={sheetOpen}
          location={editingLocation}
          onClose={() => setSheetOpen(false)}
        />
      </div>
    );
  }

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
                {["LOCATION", "ADDRESS", "STAFF", "TODAY", "REVENUE · 7D"].map((heading) => (
                  <span
                    key={heading}
                    className="font-sans text-[11px] font-semibold tracking-[0.05em] text-tn-muted-5"
                  >
                    {heading}
                  </span>
                ))}
                <span className="text-right font-sans text-[11px] font-semibold tracking-[0.05em] text-tn-muted-5">
                  ACTIONS
                </span>
              </div>

              {visible.map((loc, index) => (
                /*
                  The whole row is clickable for the mouse, but the row is
                  not the accessible control — the location name below is a
                  real <button>, so keyboard and screen-reader users get a
                  proper target and nothing nests an interactive element
                  inside another one. Same disable pair as Modal.tsx's
                  backdrop, and for the same reason.
                */
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                <div
                  key={loc.id}
                  onClick={() => openDetail(loc)}
                  style={{
                    gridTemplateColumns: ROW_GRID,
                    // The status edge replaces the pill, which cost a whole
                    // column to say one word.
                    borderLeftColor: statusColour(loc),
                  }}
                  className={`group grid cursor-pointer items-center gap-3.5 border-l-[3px] py-3.5 pr-4 pl-4 hover:bg-tn-page ${
                    index < visible.length - 1 ? "border-b border-tn-border-soft" : ""
                  }`}
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail(loc);
                      }}
                      className="cursor-pointer truncate border-none bg-transparent p-0 text-left font-sans text-[13px] font-semibold text-tn-ink"
                    >
                      {loc.name}
                    </button>
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
                    {/* Ranked below "needs setup", not merged into it: a
                        shop with no hours at all isn't bookable yet,
                        while this one is bookable and wrong, which is
                        the more urgent of the two but reads as noise if
                        it displaces the setup prompt. */}
                    {(collisionsByLocation.get(loc.id) ?? 0) > 0 && (
                      <span className="mt-0.5 w-fit rounded-full bg-tn-danger-bg px-1.5 py-0.5 font-sans text-[10px] font-semibold text-tn-danger">
                        {collisionsByLocation.get(loc.id)} scheduling{" "}
                        {collisionsByLocation.get(loc.id) === 1 ? "clash" : "clashes"}
                      </span>
                    )}
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
                      onClick={(e) => {
                        // The row itself opens the detail pane; these two
                        // do something else, so they must not also trigger it.
                        e.stopPropagation();
                        setQrLocation(loc);
                      }}
                      aria-label={`QR code for ${loc.name}`}
                      className="cursor-pointer rounded-lg border border-tn-input-border bg-transparent px-2.5 py-1.5 font-sans text-[11px] font-semibold text-tn-ink-soft hover:bg-tn-surface"
                    >
                      QR
                    </button>
                    {canManageLocations &&
                      (loc.needsSetup ? (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDetail(loc);
                          }}
                        >
                          Finish setup
                        </Button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingLocation(loc);
                            setSheetOpen(true);
                          }}
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

export default LocationsPage;
