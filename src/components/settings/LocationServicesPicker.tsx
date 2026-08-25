import { useQueries } from "@tanstack/react-query";
import { useAuthStore } from "@/auth/auth-store";
import { listServices, type Service } from "@/lib/services-api";
import type { ServiceIdsByLocation } from "@/lib/staff-api";

/**
 * The Services step, once both sides went many-to-many.
 *
 * A member works at several shops and a service is offered at several
 * shops, so "which services does this person do" has no single answer —
 * the menu differs per site, and the same person may cut hair at one
 * branch and only do beards at another. So this renders one section per
 * selected location, each listing that location's own menu.
 *
 * One query per location rather than one union query: `listServices`
 * already narrows by location, the menus genuinely differ, and React
 * Query caches each of them under the same ["services", locationId] key
 * the rest of the app uses — so switching a location off and back on is
 * free.
 */
export function LocationServicesPicker({
  locations,
  value,
  onChange,
}: {
  /** The shops currently ticked for this member, in the order they should appear. */
  locations: { id: string; name: string }[];
  value: ServiceIdsByLocation;
  onChange: (next: ServiceIdsByLocation) => void;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);

  const results = useQueries({
    queries: locations.map((loc) => ({
      queryKey: ["services", loc.id],
      queryFn: () => listServices(accessToken ?? "", loc.id),
      enabled: !!accessToken,
    })),
  });

  function toggle(locationId: string, serviceId: string) {
    const current = value[locationId] ?? [];
    const next = current.includes(serviceId)
      ? current.filter((id) => id !== serviceId)
      : [...current, serviceId];
    // Drop the key entirely when nothing is left, so the payload says
    // "nothing assigned here" rather than carrying an empty array around.
    const { [locationId]: _dropped, ...rest } = value;
    onChange(next.length > 0 ? { ...rest, [locationId]: next } : rest);
  }

  if (locations.length === 0) {
    return (
      <p className="m-0 font-sans text-sm text-tn-muted-5">
        Pick at least one location first — services are assigned per shop.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {locations.map((loc, index) => {
        const result = results[index];
        const services: Service[] = result?.data?.services ?? [];
        const assigned = value[loc.id] ?? [];
        return (
          <div key={loc.id} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <p className="m-0 font-sans text-[13px] font-semibold text-tn-ink">{loc.name}</p>
              <span className="font-sans text-[11px] text-tn-muted-5">
                {assigned.length} of {services.length} assigned
              </span>
            </div>

            {result?.isPending && (
              <p className="m-0 font-sans text-sm text-tn-muted-5">Loading services…</p>
            )}
            {result?.isError && (
              <p className="m-0 font-sans text-sm text-tn-danger">
                Couldn&rsquo;t load this location&rsquo;s services.
              </p>
            )}
            {result?.isSuccess && services.length === 0 && (
              <p className="m-0 rounded-xl border border-dashed border-tn-border px-3.5 py-3 font-sans text-[13px] text-tn-muted-5">
                No services are offered here yet. You can assign some once this shop has a menu.
              </p>
            )}

            {services.length > 0 && (
              <div className="flex max-h-64 flex-col overflow-y-auto rounded-xl border border-tn-border">
                <div className="grid grid-cols-[2fr_1fr_1fr_0.8fr] bg-tn-table-head px-4 py-2.5 font-sans text-xs font-semibold text-tn-muted-5">
                  <span>SERVICE</span>
                  <span>COST</span>
                  <span>DURATION</span>
                  <span>ASSIGNED</span>
                </div>
                {services.map((service, i) => (
                  <label
                    key={service.id}
                    className={`grid cursor-pointer grid-cols-[2fr_1fr_1fr_0.8fr] items-center px-4 py-3 transition-colors duration-150 hover:bg-tn-page ${
                      i < services.length - 1 ? "border-b border-tn-border-soft" : ""
                    }`}
                  >
                    <span className="font-sans text-[13px] text-tn-ink">{service.name}</span>
                    <span className="font-sans text-[13px] text-tn-muted-3">
                      ${(service.priceCents / 100).toFixed(2)}
                    </span>
                    <span className="font-sans text-[13px] text-tn-muted-3">
                      {service.durationMinutes} min
                    </span>
                    <input
                      type="checkbox"
                      checked={assigned.includes(service.id)}
                      onChange={() => toggle(loc.id, service.id)}
                      className="size-4 accent-tn-gold"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default LocationServicesPicker;
