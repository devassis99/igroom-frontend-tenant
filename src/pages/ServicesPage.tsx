import { useMemo, useState, type DragEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ServiceModal } from "@/components/services/ServiceModal";
import { CategoriesModal } from "@/components/services/CategoriesModal";
import { ServiceLocationsModal } from "@/components/services/ServiceLocationsModal";
import { useAuthStore } from "@/auth/auth-store";
import { usePermissions } from "@/auth/use-permissions";
import { listLocations } from "@/lib/locations-api";
import {
  deleteService,
  listCategories,
  listServices,
  reorderServices,
  updateService,
  SALES_TAX_LABEL,
  type Service,
  type ServiceCategory,
} from "@/lib/services-api";

// Stable empty-array fallbacks — see CalendarPage.tsx's identical comment
// on why a fresh `[]` literal per render would defeat useMemo below.
const EMPTY_SERVICES: Service[] = [];
const EMPTY_CATEGORIES: ServiceCategory[] = [];

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * How the LOCATIONS cell reads. "Nowhere" is called out rather than shown
 * as "0" because it's the one state that means the service can't be
 * booked at all — a catalogue entry nobody sells.
 */
function locationsLabel(service: Service, totalLocations: number): string {
  const count = service.locations.length;
  if (count === 0) return "Nowhere";
  if (totalLocations > 0 && count === totalLocations) {
    return totalLocations === 1
      ? (service.locations[0]?.locationName ?? "1 location")
      : "All locations";
  }
  if (count === 1) return service.locations[0]!.locationName;
  return `${service.locations[0]!.locationName} +${count - 1}`;
}

/** RFC 4180-ish — good enough for names/categories that might contain commas or quotes. */
function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function downloadServicesCsv(rows: Service[]) {
  const header = ["Service Name", "Duration", "Price", "Tax", "Category", "Status"];
  const lines = [
    header.join(","),
    ...rows.map((s) =>
      [
        csvCell(s.name),
        csvCell(formatDuration(s.durationMinutes)),
        csvCell(formatPrice(s.priceCents)),
        csvCell(s.taxable ? SALES_TAX_LABEL : "—"),
        csvCell(s.categoryName ?? "—"),
        csvCell(s.isEnabled ? "Enabled" : "Disabled"),
      ].join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "services.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const GRID_COLUMNS = "40px 1.7fr 0.9fr 0.8fr 1.2fr 0.9fr 1.1fr 0.9fr 40px";

/** Matches the mockup's T9 Services table + T9b Add/Edit Service modal, now backed by real igroom-backend data (see services-api.ts) instead of a static list. */
export function ServicesPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const { has: hasPermission } = usePermissions();
  const canManageServices = hasPermission("services.manage");

  const [search, setSearch] = useState("");
  const [modalService, setModalService] = useState<Service | null | undefined>(undefined);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Service | null>(null);
  const [locationsService, setLocationsService] = useState<Service | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const servicesQuery = useQuery({
    queryKey: ["services"],
    queryFn: () => listServices(accessToken ?? ""),
    enabled: !!accessToken,
  });
  const services = servicesQuery.data?.services ?? EMPTY_SERVICES;

  // Only for the LOCATIONS cell's "All locations" wording — the modal
  // reads the same cached query when it opens.
  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: () => listLocations(accessToken ?? ""),
    enabled: !!accessToken,
  });
  const locationCount = locationsQuery.data?.locations.length ?? 0;

  const categoriesQuery = useQuery({
    queryKey: ["service-categories"],
    queryFn: () => listCategories(accessToken ?? ""),
    enabled: !!accessToken,
  });
  const categories = categoriesQuery.data?.categories ?? EMPTY_CATEGORIES;

  const filtered = useMemo(
    () => services.filter((s) => s.name.toLowerCase().includes(search.toLowerCase())),
    [services, search],
  );
  // Dragging while a search is active would reorder a list that isn't
  // the real underlying order, so reordering is search-only when the
  // full list is showing — matches T9's SORT column always being
  // *visible*, just not always *interactive*.
  const canReorder = search.trim() === "";

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => reorderServices(accessToken ?? "", orderedIds),
    onSuccess: (data) => queryClient.setQueryData(["services"], data),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) =>
      updateService(accessToken ?? "", id, { isEnabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["services"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteService(accessToken ?? "", id),
    onSuccess: () => {
      setPendingDelete(null);
      queryClient.invalidateQueries({ queryKey: ["services"] });
    },
  });

  function moveService(fromId: string, toId: string) {
    if (fromId === toId) return;
    const ids = services.map((s) => s.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from === -1 || to === -1) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]!);
    reorderMutation.mutate(ids);
  }

  function resetServiceOrder() {
    const alphabetical = [...services]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => s.id);
    reorderMutation.mutate(alphabetical);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    if (!canReorder) return;
    e.preventDefault();
  }

  function handleDrop(e: DragEvent<HTMLDivElement>, targetId: string) {
    if (!canReorder) return;
    e.preventDefault();
    if (draggedId) moveService(draggedId, targetId);
    setDraggedId(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="m-0 font-serif text-[26px] font-semibold text-tn-ink">Services</h1>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border border-tn-input-border px-3.5 py-2.5 font-sans text-sm text-tn-ink outline-none focus:border-2 focus:border-tn-gold"
          />
          <Button onClick={() => setModalService(null)}>+ Add Service</Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => setCategoriesOpen(true)}>
          Categories
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={resetServiceOrder}
          disabled={reorderMutation.isPending || services.length === 0}
        >
          Reset service order
        </Button>
        <div className="flex-1" />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => downloadServicesCsv(filtered)}
          disabled={filtered.length === 0}
        >
          Export to CSV
        </Button>
      </div>

      {servicesQuery.isError && (
        <p className="m-0 font-sans text-sm text-tn-danger">
          Couldn&rsquo;t load services right now (
          {servicesQuery.error instanceof Error ? servicesQuery.error.message : "unknown error"}) —
          refresh to try again.
        </p>
      )}

      <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border">
        <div
          className="grid bg-tn-table-head px-[18px] py-3 font-sans text-xs font-semibold text-tn-muted-5"
          style={{ gridTemplateColumns: GRID_COLUMNS }}
        >
          <span>SORT</span>
          <span>SERVICE NAME</span>
          <span>DURATION</span>
          <span>PRICE</span>
          <span>TAX</span>
          <span>CATEGORY</span>
          <span>LOCATIONS</span>
          <span>STATUS</span>
          <span />
        </div>

        {servicesQuery.isPending && (
          <p className="m-0 p-[18px] font-sans text-sm text-tn-muted-5">Loading services…</p>
        )}
        {!servicesQuery.isPending && filtered.length === 0 && (
          <p className="m-0 p-[18px] font-sans text-sm text-tn-muted-5">
            {search ? `No services match "${search}".` : "No services yet — add your first one."}
          </p>
        )}

        {filtered.map((service, i) => (
          <div
            key={service.id}
            draggable={canReorder}
            onDragStart={() => setDraggedId(service.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, service.id)}
            onDragEnd={() => setDraggedId(null)}
            onClick={() => setModalService(service)}
            // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- a real <button> can't contain the status-toggle/delete <button>s further down this row (nested buttons are invalid HTML and get silently broken apart by the browser) — same reasoning as Modal.tsx's identical disable.
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") setModalService(service);
            }}
            className={`grid cursor-pointer items-center px-[18px] py-3.5 text-left ${
              i < filtered.length - 1 ? "border-b border-tn-border-soft" : ""
            } ${draggedId === service.id ? "opacity-40" : ""}`}
            style={{ gridTemplateColumns: GRID_COLUMNS }}
          >
            <span
              className={canReorder ? "cursor-grab text-tn-faint-2" : "text-tn-faint-2 opacity-40"}
              title={canReorder ? "Drag to reorder" : "Clear search to reorder"}
            >
              &#8645;
            </span>
            <span className="font-sans text-[13px] font-semibold text-tn-ink">{service.name}</span>
            <span className="font-sans text-[13px] text-tn-muted-2">
              {formatDuration(service.durationMinutes)}
            </span>
            <span className="font-sans text-[13px] text-tn-muted-2">
              {formatPrice(service.priceCents)}
            </span>
            <span className="font-sans text-[13px] text-tn-muted-2">
              {service.taxable ? SALES_TAX_LABEL : "—"}
            </span>
            <span className="font-sans text-[13px] text-tn-muted-2">
              {service.categoryName ?? "—"}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLocationsService(service);
              }}
              title="Choose which locations offer this"
              className={`w-fit cursor-pointer rounded-full border px-2.5 py-1 font-sans text-[11px] font-medium ${
                service.locations.length === 0
                  ? "border-tn-gold-soft bg-tn-gold-bg text-tn-gold"
                  : "border-tn-input-border bg-transparent text-tn-ink-soft hover:bg-tn-page"
              }`}
            >
              {locationsLabel(service, locationCount)}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleMutation.mutate({ id: service.id, isEnabled: !service.isEnabled });
              }}
              disabled={toggleMutation.isPending}
              className="w-fit"
              title="Toggle enabled/disabled"
            >
              <StatusPill tone={service.isEnabled ? "success" : "neutral"}>
                {service.isEnabled ? "Enabled" : "Disabled"}
              </StatusPill>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPendingDelete(service);
              }}
              aria-label={`Delete ${service.name}`}
              title="Delete service"
              className="cursor-pointer justify-self-end border-none bg-transparent font-sans text-base text-tn-muted-6 hover:text-tn-danger"
            >
              &times;
            </button>
          </div>
        ))}
      </div>

      <ServiceLocationsModal
        service={locationsService}
        onClose={() => setLocationsService(null)}
        accessToken={accessToken ?? ""}
        canManage={canManageServices}
      />

      <ServiceModal
        open={modalService !== undefined}
        onClose={() => setModalService(undefined)}
        service={modalService ?? null}
        categories={categories}
        accessToken={accessToken ?? ""}
      />

      <CategoriesModal
        open={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
        accessToken={accessToken ?? ""}
      />

      <ConfirmModal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
        title={`Delete “${pendingDelete?.name}”?`}
        body="This removes it from the Services list. Past bookings that used this service keep their own record of what was done, unaffected."
        confirmLabel="Delete service"
        confirming={deleteMutation.isPending}
      />
    </div>
  );
}

export default ServicesPage;
