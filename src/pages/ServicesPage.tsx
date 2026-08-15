import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { ServiceModal } from "@/components/services/ServiceModal";
import { SERVICES, type Service } from "@/lib/sample-data";

/** Matches the mockup's T9 Services table + T9b Add/Edit Service modal. */
export function ServicesPage() {
  const [search, setSearch] = useState("");
  const [modalService, setModalService] = useState<Service | null | undefined>(undefined);

  const filtered = useMemo(
    () => SERVICES.filter((s) => s.name.toLowerCase().includes(search.toLowerCase())),
    [search],
  );

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
        <Button variant="secondary" size="sm">
          Categories
        </Button>
        <Button variant="secondary" size="sm">
          Reset service order
        </Button>
        <div className="flex-1" />
        <Button variant="secondary" size="sm">
          Export to CSV
        </Button>
      </div>

      <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border">
        <div className="grid grid-cols-[40px_2fr_1fr_1fr_1.3fr_1fr_1fr] bg-tn-table-head px-[18px] py-3 font-sans text-xs font-semibold text-tn-muted-5">
          <span>SORT</span>
          <span>SERVICE NAME</span>
          <span>DURATION</span>
          <span>PRICE</span>
          <span>TAX</span>
          <span>CATEGORY</span>
          <span>STATUS</span>
        </div>
        {filtered.map((service, i) => (
          <button
            key={service.id}
            type="button"
            onClick={() => setModalService(service)}
            className={`grid grid-cols-[40px_2fr_1fr_1fr_1.3fr_1fr_1fr] items-center px-[18px] py-3.5 text-left ${
              i < filtered.length - 1 ? "border-b border-tn-border-soft" : ""
            }`}
          >
            <span className="text-tn-faint-2">⇅</span>
            <span className="font-sans text-[13px] font-semibold text-tn-ink">{service.name}</span>
            <span className="font-sans text-[13px] text-tn-muted-2">{service.duration}</span>
            <span className="font-sans text-[13px] text-tn-muted-2">${service.price.toFixed(2)}</span>
            <span className="font-sans text-[13px] text-tn-muted-2">{service.tax || "—"}</span>
            <span className="font-sans text-[13px] text-tn-muted-2">{service.category || "—"}</span>
            <StatusPill tone={service.status === "Enabled" ? "success" : "neutral"}>
              {service.status}
            </StatusPill>
          </button>
        ))}
      </div>

      <ServiceModal
        open={modalService !== undefined}
        onClose={() => setModalService(undefined)}
        service={modalService ?? null}
      />
    </div>
  );
}

export default ServicesPage;
