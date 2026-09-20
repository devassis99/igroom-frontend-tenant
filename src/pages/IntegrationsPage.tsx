import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { integrationKeys } from "@/lib/integrations-api";
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
  const {
    search,
    setSearch,
    category,
    setCategory,
    connectedCount,
    filtered,
    status,
    error,
    retry,
  } = useIntegrationsFilter();
  const activeShape = CATEGORIES.find((c) => c.label === category)?.shape ?? "square";

  /**
   * Where a barber lands coming back from Google.
   *
   * The callback redirects here with ?calendar=connected&blocked=N, and
   * the number is the whole point: somebody who grants access, gets sent
   * back, and sees a screen identical to the one they left assumes it
   * failed.
   *
   * Read into state on the first render rather than straight off the URL,
   * because the effect below immediately strips those params so a refresh
   * or a bookmark can't replay the message. Read live, the banner would
   * render for exactly one frame and then delete its own reason for
   * existing.
   */
  const [params, setParams] = useSearchParams();
  const [arrival] = useState(() => ({
    outcome: params.get("calendar"),
    blocked: Number(params.get("blocked") ?? "0"),
    reason: params.get("reason"),
  }));
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!arrival.outcome) return;
    void queryClient.invalidateQueries({ queryKey: integrationKeys.all });
    const next = new URLSearchParams(window.location.search);
    next.delete("calendar");
    next.delete("blocked");
    next.delete("reason");
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per arrival; `arrival` is frozen at mount
  }, []);

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
            data-tour="integrations-search"
            type="text"
            placeholder="Search integrations"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-[220px] rounded-xl border border-tn-input-border px-4 py-2.5 font-sans text-[13px] text-tn-ink outline-none focus:border-2 focus:border-tn-gold"
          />
        </div>

        {status === "error" && (
          <div className="flex flex-col gap-2 rounded-xl border border-tn-danger/40 bg-tn-danger-bg px-4 py-3">
            <p className="m-0 font-sans text-[13px] font-semibold text-tn-ink">
              Couldn&rsquo;t load your integrations
            </p>
            {/* The server's own words, not a friendly paraphrase. This is
                an owner's admin screen, and the message is usually the
                whole diagnosis — a missing table says so by name. */}
            <p className="m-0 font-mono text-[11.5px] leading-relaxed break-words text-tn-ink-soft">
              {error?.message ?? "Unknown error"}
            </p>
            <button
              type="button"
              onClick={retry}
              className="w-fit cursor-pointer rounded-lg border border-tn-input-border bg-tn-surface px-3 py-1.5 font-sans text-xs font-semibold text-tn-ink transition-colors duration-200 hover:bg-tn-page"
            >
              Try again
            </button>
          </div>
        )}

        {arrival.outcome === "connected" && (
          <div className="tn-rise-in rounded-xl border border-tn-success/40 bg-tn-success-bg px-4 py-3">
            <p className="m-0 font-sans text-[13px] leading-relaxed text-tn-ink">
              <strong className="font-semibold">Google Calendar connected.</strong>{" "}
              {arrival.blocked === 0
                ? "Nothing on it is blocking time yet — anything you add will be, within minutes."
                : `${arrival.blocked} ${arrival.blocked === 1 ? "event is" : "events are"} now blocking time on your calendar here.`}
            </p>
          </div>
        )}
        {arrival.outcome === "failed" && (
          <div className="tn-rise-in rounded-xl border border-tn-danger/40 bg-tn-danger-bg px-4 py-3">
            <p className="m-0 font-sans text-[13px] leading-relaxed text-tn-ink">
              <strong className="font-semibold">Couldn&rsquo;t finish connecting.</strong>{" "}
              {arrival.reason ?? "Try again, and tell us if it keeps happening."}
            </p>
          </div>
        )}
        {arrival.outcome === "cancelled" && (
          <div className="tn-rise-in rounded-xl border border-tn-border bg-tn-page px-4 py-3">
            <p className="m-0 font-sans text-[13px] text-tn-muted-1">
              Nothing was connected — you can start again whenever you like.
            </p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full ${connectedCount > 0 ? "bg-tn-success" : "bg-tn-border"}`}
          />
          <span className="font-sans text-sm font-semibold text-tn-ink">
            Connected integrations: {connectedCount}
          </span>
        </div>

        <IntegrationCardGrid integrations={filtered} search={search} status={status} />
      </div>
    </div>
  );
}

export default IntegrationsPage;
