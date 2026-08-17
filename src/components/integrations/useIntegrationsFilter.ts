import { useMemo, useState } from "react";
import { INTEGRATIONS } from "@/lib/sample-data";
import type { Category } from "./CategoryNav";

/** Search + category filtering shared by both Integrations entry points — see CategoryNav.tsx. */
export function useIntegrationsFilter() {
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

  return { search, setSearch, category, setCategory, connectedCount, filtered };
}
