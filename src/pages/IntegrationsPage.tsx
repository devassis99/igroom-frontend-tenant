import { CategoryIcon, CategoryNav, CATEGORIES } from "@/components/integrations/CategoryNav";
import { IntegrationCardGrid } from "@/components/integrations/IntegrationCardGrid";
import { useIntegrationsFilter } from "@/components/integrations/useIntegrationsFilter";

/**
 * Matches the mockup's T12f Integrations page, reached via Settings >
 * Integrations. The sidebar's own Integrations link instead opens
 * IntegrationsModal.tsx (T13b) — both share CategoryNav/IntegrationCardGrid
 * so the two entry points can't drift apart.
 */
export function IntegrationsPage() {
  const { search, setSearch, category, setCategory, connectedCount, filtered } =
    useIntegrationsFilter();
  const activeShape = CATEGORIES.find((c) => c.label === category)?.shape ?? "square";

  return (
    <div className="flex gap-8">
      <CategoryNav value={category} onChange={setCategory} />

      <div className="flex flex-1 flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="m-0 flex items-center gap-2.5 font-serif text-[22px] font-semibold text-tn-ink">
            <CategoryIcon shape={activeShape} active />
            {category}
          </h1>
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

        <IntegrationCardGrid integrations={filtered} search={search} />
      </div>
    </div>
  );
}

export default IntegrationsPage;
