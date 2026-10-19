import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { PageRange, Pagination } from "@/components/ui/Pagination";
import { StatCard } from "@/components/ui/StatCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { AddCustomerModal } from "@/components/customers/AddCustomerModal";
import { CustomerJourneyModal } from "@/components/customers/CustomerJourneyModal";
import { useAuthStore } from "@/auth/auth-store";
import { usePermissions } from "@/auth/use-permissions";
import {
  listCustomers,
  type Customer,
  type CustomerFilter,
  type CustomerStats,
} from "@/lib/customers-api";

type Filter = "All" | "VIP" | "New" | "Inactive 90d+";

const FILTERS: Filter[] = ["All", "VIP", "New", "Inactive 90d+"];

/** Each chip as the API names it. */
const FILTER_PARAM: Record<Filter, CustomerFilter> = {
  All: "all",
  VIP: "vip",
  New: "new",
  "Inactive 90d+": "inactive",
};

/** Long enough that typing a name is one request, not one per letter. */
const SEARCH_DEBOUNCE_MS = 300;

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

/**
 * Matches the mockup's T10c Customers table + T10d Customer Journey drawer,
 * backed by igroom-backend (see customers-api.ts). Paged server-side,
 * newest customer first; search and the filter chips run on the server
 * too, since a page only holds a slice of the list. The stat tiles are
 * account-wide whatever the table is showing.
 */
export function CustomersPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { has: hasPermission } = usePermissions();
  const canManageCustomers = hasPermission("customers.manage");

  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  // The customer object, not just their id: a refetch can move them onto
  // another page (somebody else adds a customer), and the drawer
  // shouldn't vanish while it's being read.
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  // Search, filter and page size each start again from page 1 — set in the
  // same update, so the old page isn't fetched once for the new query.
  useEffect(() => {
    const term = search.trim();
    if (term === appliedSearch) return;
    const timer = setTimeout(() => {
      setAppliedSearch(term);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, appliedSearch]);

  function chooseFilter(next: Filter) {
    setFilter(next);
    setPage(1);
  }

  function choosePageSize(next: number) {
    setPageSize(next);
    setPage(1);
  }

  /** A customer just added is the newest, so they're first on page 1 — with nothing hiding them. */
  function showNewest() {
    setSearch("");
    setAppliedSearch("");
    setFilter("All");
    setPage(1);
  }

  const customersQuery = useQuery({
    queryKey: ["customers", { page, pageSize, search: appliedSearch, filter }],
    queryFn: () =>
      listCustomers(accessToken ?? "", {
        page,
        pageSize,
        search: appliedSearch,
        filter: FILTER_PARAM[filter],
      }),
    enabled: !!accessToken,
    // The page on screen stays put (dimmed) while the next one loads,
    // instead of the table collapsing to "Loading…" on every click.
    placeholderData: keepPreviousData,
  });
  const customers = customersQuery.data?.customers ?? EMPTY_CUSTOMERS;
  const stats = customersQuery.data?.stats ?? EMPTY_STATS;
  const totalCount = customersQuery.data?.totalCount ?? 0;
  const isChangingPage = customersQuery.isPlaceholderData;

  // The list can shrink under us (a refetch after customers were merged
  // or edited elsewhere) — step back to the last page that has rows
  // rather than show an empty one.
  useEffect(() => {
    const data = customersQuery.data;
    if (!data || customersQuery.isPlaceholderData) return;
    const lastPage = Math.max(1, Math.ceil(data.totalCount / data.pageSize));
    if (data.page > lastPage) setPage(lastPage);
  }, [customersQuery.data, customersQuery.isPlaceholderData]);

  const selected = selectedCustomer
    ? (customers.find((c) => c.id === selectedCustomer.id) ?? selectedCustomer)
    : null;

  const isNarrowed = appliedSearch !== "" || filter !== "All";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="m-0 font-sans text-[24px] font-semibold text-tn-ink">Customers</h1>
        {canManageCustomers && (
          <Button data-tour="customers-add" onClick={() => setAddOpen(true)}>
            + Add Customer
          </Button>
        )}
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

      <div className="flex flex-wrap items-center gap-3" data-tour="customers-search">
        <input
          type="search"
          placeholder="Search by name, phone, or email"
          aria-label="Search customers"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[260px] flex-1 rounded-xl border border-tn-input-border px-3.5 py-2.5 font-sans text-sm text-tn-ink outline-none focus:border-2 focus:border-tn-gold"
        />
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => chooseFilter(f)}
              aria-pressed={filter === f}
              className={`rounded-full px-3.5 py-2 font-sans text-xs font-medium ${
                filter === f ? "bg-tn-dark text-tn-on-dark" : "bg-tn-page text-tn-muted-2"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div data-tour="customers-stats" className="grid grid-cols-2 gap-5 sm:grid-cols-4">
        <StatCard label="Total customers" value={String(stats.totalCustomers)} />
        <StatCard label="New this month" value={String(stats.newThisMonth)} />
        <StatCard label="Repeat rate" value={`${stats.repeatRatePct}%`} />
        <StatCard label="Avg lifetime spend" value={dollars(stats.avgLifetimeSpendCents)} />
      </div>

      {customersQuery.isSuccess && totalCount === 0 && !isChangingPage && (
        <p className="m-0 font-sans text-sm text-tn-muted-5">
          {isNarrowed || stats.totalCustomers > 0
            ? "No customers match your search/filter."
            : "No customers yet — they'll show up here automatically the first time you book one, or add one directly."}
        </p>
      )}

      {customers.length > 0 && (
        <div className="flex flex-col gap-3">
          <PageRange page={page} pageSize={pageSize} totalCount={totalCount} noun="customers" />
          <div
            aria-busy={isChangingPage}
            className={`flex flex-col overflow-hidden rounded-2xl border border-tn-border transition-opacity ${
              isChangingPage ? "opacity-60" : ""
            }`}
          >
            <div className="grid grid-cols-[1.8fr_1fr_0.8fr_1fr_1.2fr_1fr] bg-tn-table-head px-[18px] py-3 font-sans text-xs font-semibold text-tn-muted-5">
              <span>Customer</span>
              <span>Last visit</span>
              <span>Visits</span>
              <span>Lifetime spend</span>
              <span>Preferred barber</span>
              <span>Tags</span>
            </div>
            {customers.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCustomer(c)}
                className={`grid grid-cols-[1.8fr_1fr_0.8fr_1fr_1.2fr_1fr] items-center px-[18px] py-3.5 text-left ${
                  i < customers.length - 1 ? "border-b border-tn-border-soft" : ""
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Avatar initials={initialsFor(c.name)} color={avatarColorFor(c.id)} size={28} />
                  <span>
                    <p className="m-0 font-sans text-[14px] font-semibold text-tn-ink">{c.name}</p>
                    <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">
                      {c.phone || c.email || "—"}
                    </p>
                  </span>
                </span>
                <span className="font-sans text-[14px] text-tn-muted-2">
                  {formatLastVisit(c.lastVisitAt)}
                </span>
                <span className="font-sans text-[14px] text-tn-muted-2">{c.visits}</span>
                <span className="font-sans text-[14px] text-tn-muted-2">
                  {dollars(c.lifetimeSpendCents)}
                </span>
                <span className="font-sans text-[14px] text-tn-muted-2">
                  {c.preferredBarber ?? "—"}
                </span>
                {c.tag && <StatusPill tone={TAG_TONE[c.tag]}>{c.tag}</StatusPill>}
              </button>
            ))}
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={setPage}
            onPageSizeChange={choosePageSize}
          />
        </div>
      )}

      <AddCustomerModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={showNewest} />
      <CustomerJourneyModal customer={selected} onClose={() => setSelectedCustomer(null)} />
    </div>
  );
}

export default CustomersPage;
