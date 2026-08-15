import { useMemo, useState } from "react";
import { INTEGRATIONS, type Integration } from "@/lib/sample-data";

type Category = "All Integrations" | Integration["category"];

const CATEGORIES: Category[] = [
  "All Integrations",
  "Communication",
  "Scheduling",
  "Payments",
  "Marketing",
  "Reviews",
  "Automation",
];

/**
 * Matches the mockup's T12f Integrations page (and doubles as the target
 * for the sidebar's Integrations link — see AppShell.tsx's note on why
 * T13b's Dashboard-modal version of this screen isn't duplicated).
 */
export function IntegrationsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("All Integrations");

  const connectedCount = INTEGRATIONS.filter((i) => i.connected).length;

  const filtered = useMemo(() => {
    return INTEGRATIONS.filter((i) => {
      const matchesCategory = category === "All Integrations" || i.category === category;
      const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [search, category]);

  return (
    <div className="flex gap-8">
      <nav className="flex w-[200px] flex-none flex-col gap-0.5">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`rounded-lg px-4 py-2.5 text-left font-sans text-[13px] ${
              category === c ? "bg-tn-dark font-semibold text-tn-on-dark" : "font-medium text-tn-nav-inactive"
            }`}
          >
            {c}
          </button>
        ))}
      </nav>

      <div className="flex flex-1 flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="m-0 font-serif text-[22px] font-semibold text-tn-ink">All Integrations</h1>
          <input
            type="text"
            placeholder="Search integrations"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-[220px] rounded-xl border border-tn-input-border px-4 py-2.5 font-sans text-[13px] text-tn-ink outline-none focus:border-2 focus:border-tn-gold"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-tn-success" />
          <span className="font-sans text-sm font-semibold text-tn-ink">
            Connected integrations: {connectedCount}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((integration) => (
            <div
              key={integration.id}
              className="flex flex-col gap-2 rounded-2xl border border-tn-border p-[18px]"
            >
              <div className="flex items-center gap-2">
                <span aria-hidden>{integration.icon}</span>
                <span className="font-sans text-sm font-semibold text-tn-ink">
                  {integration.name}
                </span>
                {integration.connected && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-tn-success" aria-hidden />
                )}
              </div>
              <p className="m-0 font-sans text-xs leading-relaxed text-tn-muted-5">
                {integration.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default IntegrationsPage;
