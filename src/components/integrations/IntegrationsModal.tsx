import { useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { CategoryIcon, CategoryNav, CATEGORIES } from "./CategoryNav";
import { IntegrationCardGrid } from "./IntegrationCardGrid";
import { useIntegrationsFilter } from "./useIntegrationsFilter";

interface IntegrationsModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Matches the mockup's T13b — Integrations opened as a modal over whatever
 * page the sidebar link was clicked from, rather than navigating away.
 * Shares CategoryNav/IntegrationCardGrid/useIntegrationsFilter with
 * IntegrationsPage.tsx (T12f, reached via Settings) so the two entry
 * points render identical content — see AppShell.tsx's note.
 */
export function IntegrationsModal({ open, onClose }: IntegrationsModalProps) {
  const { search, setSearch, category, setCategory, connectedCount, filtered } =
    useIntegrationsFilter();
  const activeShape = CATEGORIES.find((c) => c.label === category)?.shape ?? "square";

  // AppShell keeps this component mounted for the app's whole lifetime (it
  // only opens/closes the Modal inside it), so the search/category state
  // above would otherwise sit stale between opens — reopening would show
  // whatever was typed last time. Reset once the close finishes so the
  // panel is back to its default state before it can be seen again.
  useEffect(() => {
    if (open) return;
    setSearch("");
    setCategory("All Integrations");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only `open` should retrigger this, not the setters
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} width={1000}>
      <div className="flex max-h-[85vh] min-h-[560px]">
        <div className="flex w-[230px] shrink-0 flex-col gap-6 rounded-l-2xl bg-tn-page px-5 py-6">
          <h2 className="m-0 px-1 font-serif text-lg font-semibold text-tn-ink">Integrations</h2>
          <CategoryNav value={category} onChange={setCategory} />
        </div>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-8 py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="m-0 flex items-center gap-2.5 font-serif text-[22px] font-semibold text-tn-ink">
              <CategoryIcon shape={activeShape} active />
              {category}
            </h1>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search integrations"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-[220px] rounded-xl border border-tn-input-border px-4 py-2.5 font-sans text-[13px] text-tn-ink outline-none focus:border-2 focus:border-tn-gold"
              />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="cursor-pointer border-none bg-transparent font-sans text-xl text-tn-muted-6"
              >
                &times;
              </button>
            </div>
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
    </Modal>
  );
}

export default IntegrationsModal;
