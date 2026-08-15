import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { CustomerJourneyModal } from "@/components/customers/CustomerJourneyModal";
import { CUSTOMERS, type Customer } from "@/lib/sample-data";

type Filter = "All" | "VIP" | "New" | "Inactive 90d+";

const TAG_TONE: Record<NonNullable<Customer["tag"]>, "gold" | "success" | "neutral"> = {
  VIP: "gold",
  New: "success",
  Inactive: "neutral",
};

/** Matches the mockup's T10c Customers table + T10d Customer Journey drawer. */
export function CustomersPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [selected, setSelected] = useState<Customer | null>(null);

  const filtered = useMemo(() => {
    return CUSTOMERS.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.contact.toLowerCase().includes(search.toLowerCase());
      const matchesFilter =
        filter === "All" ||
        (filter === "VIP" && c.tag === "VIP") ||
        (filter === "New" && c.tag === "New") ||
        (filter === "Inactive 90d+" && c.tag === "Inactive");
      return matchesSearch && matchesFilter;
    });
  }, [search, filter]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="m-0 font-serif text-[26px] font-semibold text-tn-ink">Customers</h1>
        <Button>+ Add Customer</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by name, phone, or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[260px] flex-1 rounded-xl border border-tn-input-border px-3.5 py-2.5 font-sans text-sm text-tn-ink outline-none focus:border-2 focus:border-tn-gold"
        />
        <div className="flex gap-2">
          {(["All", "VIP", "New", "Inactive 90d+"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3.5 py-2 font-sans text-xs font-medium ${
                filter === f ? "bg-tn-dark text-tn-on-dark" : "bg-tn-page text-tn-muted-2"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
        <StatCard label="Total customers" value="486" />
        <StatCard label="New this month" value="34" />
        <StatCard label="Repeat rate" value="68%" />
        <StatCard label="Avg lifetime spend" value="$312" />
      </div>

      <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border">
        <div className="grid grid-cols-[1.8fr_1fr_0.8fr_1fr_1.2fr_1fr] bg-tn-table-head px-[18px] py-3 font-sans text-xs font-semibold text-tn-muted-5">
          <span>Customer</span>
          <span>Last visit</span>
          <span>Visits</span>
          <span>Lifetime spend</span>
          <span>Preferred barber</span>
          <span>Tags</span>
        </div>
        {filtered.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelected(c)}
            className={`grid grid-cols-[1.8fr_1fr_0.8fr_1fr_1.2fr_1fr] items-center px-[18px] py-3.5 text-left ${
              i < filtered.length - 1 ? "border-b border-tn-border-soft" : ""
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Avatar initials={c.initials} color={c.avatarColor} size={28} />
              <span>
                <p className="m-0 font-sans text-[13px] font-semibold text-tn-ink">{c.name}</p>
                <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">{c.contact}</p>
              </span>
            </span>
            <span className="font-sans text-[13px] text-tn-muted-2">{c.lastVisit}</span>
            <span className="font-sans text-[13px] text-tn-muted-2">{c.visits}</span>
            <span className="font-sans text-[13px] text-tn-muted-2">${c.lifetimeSpend}</span>
            <span className="font-sans text-[13px] text-tn-muted-2">{c.preferredBarber}</span>
            {c.tag && <StatusPill tone={TAG_TONE[c.tag]}>{c.tag}</StatusPill>}
          </button>
        ))}
      </div>

      <CustomerJourneyModal customer={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

export default CustomersPage;
