import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { AddCustomerModal } from "@/components/customers/AddCustomerModal";
import { CustomerJourneyModal } from "@/components/customers/CustomerJourneyModal";
import { useAuthStore } from "@/auth/auth-store";
import { usePermissions } from "@/auth/use-permissions";
import { listCustomers, type Customer, type CustomerStats } from "@/lib/customers-api";

type Filter = "All" | "VIP" | "New" | "Inactive 90d+";

const TAG_TONE: Record<NonNullable<Customer["tag"]>, "gold" | "success" | "neutral"> = {
  VIP: "gold",
  New: "success",
  Inactive: "neutral",
};

// Stable empty-array/zeroed-stats fallbacks — see CalendarPage.tsx's
// identical comment on why a fresh literal per render would defeat
// memoization downstream.
const EMPTY_CUSTOMERS: Customer[] = [];
const EMPTY_STATS: CustomerStats = {
  totalCustomers: 0,
  newThisMonth: 0,
  repeatRatePct: 0,
  avgLifetimeSpendCents: 0,
};

const AVATAR_COLORS = [
  "var(--color-tn-avatar-peach)",
  "var(--color-tn-avatar-tan)",
  "var(--color-tn-avatar-cream)",
  "var(--color-tn-avatar-brown)",
  "var(--color-tn-avatar-blue)",
];

/** No stored color/photo for a real customers row — same deterministic id->color hash as StaffPage.tsx/StaffManagementPage.tsx so a given person lands on a consistent color across the app. */
function avatarColorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

function dollars(cents: number): string {
  return `$${Math.round(cents / 100)}`;
}

function formatLastVisit(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "Today";
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}

/** Matches the mockup's T10c Customers table + T10d Customer Journey drawer — now backed by real igroom-backend data (see customers-api.ts) instead of sample-data.ts's static CUSTOMERS list. Visits/spend/tags are computed server-side from real bookings. */
export function CustomersPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { has: hasPermission } = usePermissions();
  const canManageCustomers = hasPermission("customers.manage");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const customersQuery = useQuery({
    queryKey: ["customers"],
    queryFn: () => listCustomers(accessToken ?? ""),
    enabled: !!accessToken,
  });
  const customers = customersQuery.data?.customers ?? EMPTY_CUSTOMERS;
  const stats = customersQuery.data?.stats ?? EMPTY_STATS;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return customers.filter((c) => {
      const matchesSearch =
        query === "" ||
        c.name.toLowerCase().includes(query) ||
        (c.phone ?? "").toLowerCase().includes(query) ||
        (c.email ?? "").toLowerCase().includes(query);
      const matchesFilter =
        filter === "All" ||
        (filter === "VIP" && c.tag === "VIP") ||
        (filter === "New" && c.tag === "New") ||
        (filter === "Inactive 90d+" && c.tag === "Inactive");
      return matchesSearch && matchesFilter;
    });
  }, [customers, search, filter]);

  const selected = customers.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="m-0 font-serif text-[26px] font-semibold text-tn-ink">Customers</h1>
        {canManageCustomers && <Button onClick={() => setAddOpen(true)}>+ Add Customer</Button>}
      </div>

      {customersQuery.isError && (
        <p className="m-0 font-sans text-sm text-tn-danger">
          Couldn&rsquo;t load your customers right now (
          {customersQuery.error instanceof Error ? customersQuery.error.message : "unknown error"})
          — refresh to try again.
        </p>
      )}
      {customersQuery.isPending && (
        <p className="m-0 font-sans text-sm text-tn-muted-5">Loading your customers…</p>
      )}

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
        <StatCard label="Total customers" value={String(stats.totalCustomers)} />
        <StatCard label="New this month" value={String(stats.newThisMonth)} />
        <StatCard label="Repeat rate" value={`${stats.repeatRatePct}%`} />
        <StatCard label="Avg lifetime spend" value={dollars(stats.avgLifetimeSpendCents)} />
      </div>

      {!customersQuery.isPending && filtered.length === 0 && !customersQuery.isError && (
        <p className="m-0 font-sans text-sm text-tn-muted-5">
          {customers.length === 0
            ? "No customers yet — they'll show up here automatically the first time you book one, or add one directly."
            : "No customers match your search/filter."}
        </p>
      )}

      {filtered.length > 0 && (
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
              onClick={() => setSelectedId(c.id)}
              className={`grid grid-cols-[1.8fr_1fr_0.8fr_1fr_1.2fr_1fr] items-center px-[18px] py-3.5 text-left ${
                i < filtered.length - 1 ? "border-b border-tn-border-soft" : ""
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Avatar initials={initialsFor(c.name)} color={avatarColorFor(c.id)} size={28} />
                <span>
                  <p className="m-0 font-sans text-[13px] font-semibold text-tn-ink">{c.name}</p>
                  <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">
                    {c.phone || c.email || "—"}
                  </p>
                </span>
              </span>
              <span className="font-sans text-[13px] text-tn-muted-2">
                {formatLastVisit(c.lastVisitAt)}
              </span>
              <span className="font-sans text-[13px] text-tn-muted-2">{c.visits}</span>
              <span className="font-sans text-[13px] text-tn-muted-2">
                {dollars(c.lifetimeSpendCents)}
              </span>
              <span className="font-sans text-[13px] text-tn-muted-2">
                {c.preferredBarber ?? "—"}
              </span>
              {c.tag && <StatusPill tone={TAG_TONE[c.tag]}>{c.tag}</StatusPill>}
            </button>
          ))}
        </div>
      )}

      <AddCustomerModal open={addOpen} onClose={() => setAddOpen(false)} />
      <CustomerJourneyModal customer={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}

export default CustomersPage;
