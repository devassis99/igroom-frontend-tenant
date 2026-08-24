import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { listLocations } from "@/lib/locations-api";
import { setServiceLocations, type Service } from "@/lib/services-api";

interface DraftRow {
  offered: boolean;
  price: string;
  duration: string;
}

function centsToInput(cents: number | null): string {
  return cents === null ? "" : (cents / 100).toFixed(2);
}

function inputToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null;
}

/**
 * "Where do we do this?" — the Services page's half of the same join the
 * location detail's Services tab writes from the other side.
 *
 * Both directions exist because owners genuinely think both ways: "what
 * does Valencia offer" when setting up a shop, and "which shops do nails"
 * when a service changes. With one direction only, turning a service on
 * everywhere would mean opening every location in turn.
 */
export function ServiceLocationsModal({
  service,
  onClose,
  accessToken,
  canManage,
}: {
  service: Service | null;
  onClose: () => void;
  accessToken: string;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<string, DraftRow>>({});
  const [error, setError] = useState<string | null>(null);

  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: () => listLocations(accessToken),
    enabled: !!accessToken && service !== null,
  });
  // Memoised on the query data, not recomputed per render: the seeding
  // effect below depends on this list, and a fresh `[]` on every render
  // (which is what the `?? []` fallback produces while the query is still
  // pending) re-ran it, re-set the draft, and re-rendered — a loop that
  // only stopped once the locations landed.
  const locations = useMemo(() => locationsQuery.data?.locations ?? [], [locationsQuery.data]);

  // Re-seeded every time a different service is opened.
  useEffect(() => {
    if (!service) return;
    const byLocation = new Map(service.locations.map((o) => [o.locationId, o]));
    const next: Record<string, DraftRow> = {};
    for (const loc of locations) {
      const offering = byLocation.get(loc.id);
      next[loc.id] = {
        offered: offering !== undefined,
        price: centsToInput(offering?.priceCentsOverride ?? null),
        duration:
          offering?.durationMinutesOverride == null ? "" : String(offering.durationMinutesOverride),
      };
    }
    setDraft(next);
    setError(null);
  }, [service, locations]);

  const save = useMutation({
    mutationFn: () => {
      if (!service) throw new Error("No service selected");
      const payload = locations
        .filter((loc) => draft[loc.id]?.offered)
        .map((loc) => {
          const row = draft[loc.id]!;
          return {
            locationId: loc.id,
            priceCents: inputToCents(row.price),
            durationMinutes: row.duration.trim() ? Number(row.duration) : null,
          };
        });
      return setServiceLocations(accessToken, service.id, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["services"] });
      void queryClient.invalidateQueries({ queryKey: ["locations"] });
      onClose();
    },
    onError: (err: unknown) =>
      setError(err instanceof Error ? err.message : "Couldn't save where this runs"),
  });

  function update(locationId: string, patch: Partial<DraftRow>) {
    setDraft((current) => ({
      ...current,
      [locationId]: {
        ...(current[locationId] ?? { offered: false, price: "", duration: "" }),
        ...patch,
      },
    }));
  }

  return (
    <Modal open={service !== null} onClose={onClose} width={520}>
      <div className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 font-sans text-lg font-semibold text-tn-ink">
            Where do we do {service?.name}?
          </h2>
          <p className="m-0 font-sans text-xs text-tn-muted-5">
            Leave price and duration blank to use the catalogue&rsquo;s ${" "}
            {service ? (service.priceCents / 100).toFixed(2) : "0.00"} ·{" "}
            {service?.durationMinutes ?? 0} min.
          </p>
        </div>

        {locationsQuery.isPending && (
          <p className="m-0 font-sans text-sm text-tn-muted-5">Loading locations…</p>
        )}

        <div className="flex flex-col gap-2">
          {locations.map((loc) => {
            const row = draft[loc.id] ?? { offered: false, price: "", duration: "" };
            return (
              <div
                key={loc.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-tn-border-soft px-3 py-2.5"
              >
                <label
                  // Names the checkbox after the location alone — without it
                  // the accessible name is the whole row, address included.
                  aria-label={loc.name}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
                >
                  <input
                    type="checkbox"
                    checked={row.offered}
                    disabled={!canManage}
                    onChange={(e) => update(loc.id, { offered: e.target.checked })}
                    className="h-4 w-4 flex-none accent-tn-gold"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-sans text-[13px] font-medium text-tn-ink">
                      {loc.name}
                    </span>
                    <span className="truncate font-sans text-[11px] text-tn-muted-5">
                      {loc.address}
                    </span>
                  </span>
                </label>

                {row.offered && (
                  <div className="flex items-center gap-2">
                    <span className="font-sans text-xs text-tn-muted-5">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.price}
                      disabled={!canManage}
                      onChange={(e) => update(loc.id, { price: e.target.value })}
                      placeholder={service ? (service.priceCents / 100).toFixed(2) : ""}
                      aria-label={`Price at ${loc.name}`}
                      className="w-20 rounded-lg border border-tn-input-border bg-tn-surface px-2 py-1.5 font-sans text-[13px] text-tn-ink outline-none focus:border-tn-gold placeholder:text-tn-placeholder"
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      value={row.duration}
                      disabled={!canManage}
                      onChange={(e) => update(loc.id, { duration: e.target.value })}
                      placeholder={String(service?.durationMinutes ?? "")}
                      aria-label={`Duration in minutes at ${loc.name}`}
                      className="w-16 rounded-lg border border-tn-input-border bg-tn-surface px-2 py-1.5 font-sans text-[13px] text-tn-ink outline-none focus:border-tn-gold placeholder:text-tn-placeholder"
                    />
                    <span className="font-sans text-xs text-tn-muted-5">min</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && <p className="m-0 font-sans text-sm text-tn-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {canManage && (
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default ServiceLocationsModal;
