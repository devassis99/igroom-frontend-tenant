import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/auth/auth-store";
import { INTEGRATIONS, type Integration as CatalogueEntry } from "@/lib/sample-data";
import {
  integrationKeys,
  listIntegrations,
  type Integration as LiveIntegration,
  type IntegrationProvider,
} from "@/lib/integrations-api";
import type { Category } from "./CategoryNav";

/**
 * Which catalogue cards are backed by something real.
 *
 * The catalogue is a statement of intent — it says what iGroom is heading
 * towards — and that is worth showing. What is not worth showing is a
 * card claiming to be connected when nothing is behind it, which is what
 * this page did: "Connected integrations: 4", four green dots, and no
 * code anywhere that could connect anything. Anything in this map is
 * live; everything else says "coming soon" and means it.
 */
const LIVE_PROVIDERS: Record<string, IntegrationProvider> = {
  "google-calendar": "google_calendar",
  whatsapp: "whatsapp_business",
};

export interface IntegrationCard extends CatalogueEntry {
  /**
   * Whether iGroom has a provider for this card at all — known from the
   * map above, without waiting for the API.
   *
   * Separate from `live` because "we don't build this yet" and "we
   * couldn't reach the server" are different sentences, and collapsing
   * them was the bug: a failed request rendered exactly like an
   * unsupported provider, so the page's answer to a 500 was a card that
   * calmly said "Not available yet" and could not be clicked.
   */
  supported: boolean;
  /** Null until the API says otherwise — including while loading and after a failure. */
  live: LiveIntegration | null;
}

/** Search + category filtering shared by both Integrations entry points — see CategoryNav.tsx. */
export function useIntegrationsFilter() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("All Integrations");

  const accessToken = useAuthStore((s) => s.accessToken);
  const query = useQuery({
    queryKey: integrationKeys.all,
    queryFn: () => listIntegrations(accessToken ?? ""),
    // Same shape as every other query in this app: the token is passed
    // explicitly and the query simply doesn't run without one.
    enabled: !!accessToken,
  });

  const cards = useMemo<IntegrationCard[]>(() => {
    const byProvider = new Map((query.data ?? []).map((row) => [row.provider, row]));
    return INTEGRATIONS.map((entry) => {
      const provider = LIVE_PROVIDERS[entry.id];
      const live = provider ? (byProvider.get(provider) ?? null) : null;
      return {
        ...entry,
        // The catalogue's own `connected: true` is decoration from the
        // mockup. Real state comes from the API or it isn't claimed.
        connected: live?.status === "connected",
        supported: Boolean(provider),
        live: live && live.available ? live : null,
      };
    });
  }, [query.data]);

  const connectedCount = cards.filter((card) => card.connected).length;

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return cards.filter((card) => {
      const matchesCategory = category === "All Integrations" || card.category === category;
      const matchesSearch = !needle || card.name.toLowerCase().includes(needle);
      return matchesCategory && matchesSearch;
    });
  }, [cards, search, category]);

  return {
    search,
    setSearch,
    category,
    setCategory,
    connectedCount,
    filtered,
    /** Passed down so a card can say which of the three things is true, rather than defaulting to the discouraging one. */
    status: query.isError
      ? ("error" as const)
      : query.isPending
        ? ("pending" as const)
        : ("ready" as const),
    error: query.error as Error | null,
    retry: () => void query.refetch(),
  };
}
