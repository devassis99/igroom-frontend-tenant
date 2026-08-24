import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/auth/auth-store";
import {
  listLocationServices,
  setLocationServices,
  type AccountLocation,
  type LocationCatalogueEntry,
} from "@/lib/locations-api";

/** Cents in the API, dollars in the field — the same split ServiceModal.tsx uses. */
function centsToInput(cents: number | null): string {
  return cents === null ? "" : (cents / 100).toFixed(2);
}

function inputToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null;
}

interface DraftRow {
  offered: boolean;
  price: string;
  duration: string;
}

type Draft = Record<string, DraftRow>;

function draftFrom(entries: LocationCatalogueEntry[]): Draft {
  const draft: Draft = {};
  for (const entry of entries) {
    draft[entry.serviceId] = {
      offered: entry.offered,
      price: centsToInput(entry.priceCentsOverride),
      duration: entry.durationMinutesOverride === null ? "" : String(entry.durationMinutesOverride),
    };
  }
  return draft;
}

const UNCATEGORISED = "Uncategorised";

/**
 * Which of the business's services this shop actually sells, and what it
 * charges for them.
 *
 * The list is the whole catalogue, not just what's already ticked — the
 * point of the tab is turning things on and off, and a list of only the
 * things already on would make the common case (we just got the
 * hydrafacial machine) a trip to another screen first.
 *
 * Price and duration fields are *overrides*: left empty they inherit the
 * catalogue's figures, which is why the placeholder shows the inherited
 * value rather than the field being pre-filled with it. Pre-filling would
 * silently opt this location out of a future shop-wide price change.
 */
export function LocationServicesTab({
  location,
  canManage,
}: {
  location: AccountLocation;
  canManage: boolean;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const catalogueQuery = useQuery({
    queryKey: ["location-services", location.id],
    queryFn: () => listLocationServices(accessToken ?? "", location.id),
    enabled: !!accessToken,
  });

  useEffect(() => {
    if (catalogueQuery.data) setDraft(draftFrom(catalogueQuery.data.services));
  }, [catalogueQuery.data]);

  const entries = useMemo(() => catalogueQuery.data?.services ?? [], [catalogueQuery.data]);

  const grouped = useMemo(() => {
    const byCategory = new Map<string, LocationCatalogueEntry[]>();
    for (const entry of entries) {
      const key = entry.categoryName ?? UNCATEGORISED;
      const list = byCategory.get(key) ?? [];
      list.push(entry);
      byCategory.set(key, list);
    }
    return [...byCategory.entries()];
  }, [entries]);

  const save = useMutation({
    mutationFn: () => {
      const current = draft ?? {};
      const payload = entries
        .filter((entry) => current[entry.serviceId]?.offered)
        .map((entry) => {
          const row = current[entry.serviceId]!;
          return {
            serviceId: entry.serviceId,
            priceCents: inputToCents(row.price),
            durationMinutes: row.duration.trim() ? Number(row.duration) : null,
          };
        });
      return setLocationServices(accessToken ?? "", location.id, payload);
    },
    onSuccess: (result) => {
      setDraft(draftFrom(result.services));
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["location-services", location.id] });
      // The Services page's LOCATIONS column reads the other side of this
      // same join, and needsSetup on the ops table can change with it.
      void queryClient.invalidateQueries({ queryKey: ["services"] });
      void queryClient.invalidateQueries({ queryKey: ["locations"] });
    },
    onError: (err: unknown) =>
      setError(err instanceof Error ? err.message : "Couldn't save this location's menu"),
  });

  function update(serviceId: string, patch: Partial<DraftRow>) {
    setDraft((current) => ({
      ...current,
      [serviceId]: {
        ...(current?.[serviceId] ?? { offered: false, price: "", duration: "" }),
        ...patch,
      },
    }));
  }

  if (catalogueQuery.isPending || draft === null) {
    return <p className="m-0 font-sans text-sm text-tn-muted-5">Loading the menu…</p>;
  }
  if (catalogueQuery.isError) {
    return <p className="m-0 font-sans text-sm text-tn-danger">Couldn&rsquo;t load the menu.</p>;
  }

  const offeredCount = Object.values(draft).filter((row) => row.offered).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="m-0 font-sans text-sm font-semibold text-tn-ink">
          Offering {offeredCount} of {entries.length} services
        </p>
        <p className="m-0 font-sans text-xs text-tn-muted-5">
          Tick what this shop does. Leave price and duration blank to use the catalogue&rsquo;s
          figures — fill one in only where this location genuinely differs.
        </p>
      </div>

      {entries.length === 0 && (
        <p className="m-0 rounded-2xl border border-dashed border-tn-border px-4 py-6 text-center font-sans text-sm text-tn-muted-5">
          Your catalogue is empty — add services on the Services page first.
        </p>
      )}

      {grouped.map(([category, rows]) => (
        <div key={category} className="flex flex-col gap-2">
          <p className="m-0 font-sans text-[11px] font-semibold tracking-[0.05em] text-tn-muted-5">
            {category.toUpperCase()}
          </p>
          <div className="rounded-2xl border border-tn-border">
            {rows.map((entry, index) => {
              const row = draft[entry.serviceId] ?? { offered: false, price: "", duration: "" };
              return (
                <div
                  key={entry.serviceId}
                  className={`flex flex-wrap items-center gap-3 px-4 py-3 ${
                    index < rows.length - 1 ? "border-b border-tn-border-soft" : ""
                  }`}
                >
                  <label
                    // Names the checkbox after the service alone — without it
                    // the accessible name swallows the catalogue price line too.
                    aria-label={entry.name}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
                  >
                    <input
                      type="checkbox"
                      checked={row.offered}
                      disabled={!canManage}
                      onChange={(e) => update(entry.serviceId, { offered: e.target.checked })}
                      className="h-4 w-4 flex-none accent-tn-gold"
                    />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-sans text-[13px] font-medium text-tn-ink">
                        {entry.name}
                      </span>
                      <span className="truncate font-sans text-[11px] text-tn-muted-5">
                        Catalogue: ${(entry.cataloguePriceCents / 100).toFixed(2)} ·{" "}
                        {entry.catalogueDurationMinutes} min
                        {entry.isEnabled ? "" : " · disabled account-wide"}
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
                        onChange={(e) => update(entry.serviceId, { price: e.target.value })}
                        placeholder={(entry.cataloguePriceCents / 100).toFixed(2)}
                        aria-label={`Price for ${entry.name} at ${location.name}`}
                        className="w-20 rounded-lg border border-tn-input-border bg-tn-surface px-2 py-1.5 font-sans text-[13px] text-tn-ink outline-none focus:border-tn-gold placeholder:text-tn-placeholder"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        value={row.duration}
                        disabled={!canManage}
                        onChange={(e) => update(entry.serviceId, { duration: e.target.value })}
                        placeholder={String(entry.catalogueDurationMinutes)}
                        aria-label={`Duration in minutes for ${entry.name} at ${location.name}`}
                        className="w-16 rounded-lg border border-tn-input-border bg-tn-surface px-2 py-1.5 font-sans text-[13px] text-tn-ink outline-none focus:border-tn-gold placeholder:text-tn-placeholder"
                      />
                      <span className="font-sans text-xs text-tn-muted-5">min</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {error && <p className="m-0 font-sans text-sm text-tn-danger">{error}</p>}

      {canManage && entries.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save menu"}
          </Button>
        </div>
      )}
    </div>
  );
}

export default LocationServicesTab;
