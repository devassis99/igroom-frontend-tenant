import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

export const ALL_LOCATIONS_VALUE = "all";

interface LocationOption {
  id: string;
  name: string;
}

interface LocationFilterPopoverProps {
  locations: LocationOption[];
  /** ALL_LOCATIONS_VALUE ("all") or a location id. */
  value: string;
  onChange: (value: string) => void;
  /** aria-label for the trigger button — callers pass something like "Filter by location". */
  label?: string;
  /**
   * Whether an "All locations" row is offered above the list. Defaults to
   * true (Settings > Availability's picker, where `value` really can be
   * ALL_LOCATIONS_VALUE). CalendarPage passes false — its `selectedLocationId`
   * always names one real location (see the effect that seeds it from the
   * account's primary location), there's no "all" state to select there.
   */
  includeAllOption?: boolean;
}

const PANEL_WIDTH = 260;
const GAP = 6;

function FilterIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function useAnchoredPosition(open: boolean, anchorRef: RefObject<HTMLElement | null>) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setPosition(null);
      return;
    }
    const rect = anchorRef.current.getBoundingClientRect();
    setPosition({ top: rect.bottom + GAP, left: rect.left });
  }, [open, anchorRef]);

  return position;
}

/**
 * Location filter styled after the reference "Filter scheduler" popover —
 * a bordered trigger pill that opens a small panel with a header, a search
 * box, and a plain list of rows, rather than a native <select>. Kept the
 * reference's search box (filters the list client-side by name) but
 * dropped its per-row star/favorite icons — there's no backend concept of
 * a "favorite location" to back a star toggle. See the chat thread this
 * was scoped from.
 *
 * Portaled to document.body and positioned from the trigger's own
 * getBoundingClientRect() rather than as a normal child, same reasoning
 * as AccountMenu.tsx/WhatsNewDrawer.tsx: whatever header this sits in
 * may clip overflow, so a normal absolutely-positioned child risks
 * getting cut off.
 */
export function LocationFilterPopover({
  locations,
  value,
  onChange,
  label = "Filter by location",
  includeAllOption = true,
}: LocationFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const position = useAnchoredPosition(open, anchorRef);

  // Fresh search box every time the popover opens, rather than showing
  // whatever was left over from the last time it was open. Focused
  // imperatively (rather than the JSX `autoFocus` prop, which oxlint's
  // jsx-a11y/no-autofocus rule flags) so opening the popover drops you
  // straight into search.
  useEffect(() => {
    if (open) {
      setQuery("");
      searchInputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onResize() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const selectedName =
    includeAllOption && value === ALL_LOCATIONS_VALUE
      ? "All locations"
      : (locations.find((loc) => loc.id === value)?.name ??
        (includeAllOption ? "All locations" : "Select location"));

  function select(next: string) {
    onChange(next);
    setOpen(false);
  }

  const filteredLocations = query.trim()
    ? locations.filter((loc) => loc.name.toLowerCase().includes(query.trim().toLowerCase()))
    : locations;
  const showAllOption =
    includeAllOption && (!query.trim() || "all locations".includes(query.trim().toLowerCase()));

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex cursor-pointer items-center gap-2 rounded-lg border bg-tn-surface px-3 py-1.5 font-sans text-xs font-semibold text-tn-ink-soft hover:bg-tn-page ${
          open ? "border-tn-gold" : "border-tn-input-border"
        }`}
      >
        <span className="text-tn-muted-5">
          <FilterIcon />
        </span>
        {selectedName}
        <ChevronIcon open={open} />
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            aria-label={label}
            className="fixed z-50 overflow-hidden rounded-2xl border border-tn-border bg-tn-surface"
            style={{
              top: position.top,
              left: position.left,
              width: PANEL_WIDTH,
              boxShadow: "0 20px 45px -15px rgba(20,15,5,0.35)",
            }}
          >
            <div className="px-4 py-3">
              <p className="m-0 font-sans text-[13px] font-semibold text-tn-ink">{label}</p>
            </div>

            <div className="border-t border-tn-border-soft px-4 py-2.5">
              <div className="flex items-center gap-2 rounded-lg bg-tn-page px-3 py-2">
                <span className="text-tn-muted-5">
                  <SearchIcon />
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search"
                  className="w-full border-none bg-transparent font-sans text-[13px] text-tn-ink outline-none placeholder:text-tn-muted-5"
                />
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto border-t border-tn-border-soft py-1.5">
              {showAllOption && (
                <button
                  type="button"
                  onClick={() => select(ALL_LOCATIONS_VALUE)}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 border-none bg-transparent px-4 py-2.5 text-left font-sans text-[13px] font-medium text-tn-ink-soft hover:bg-tn-page"
                >
                  All locations
                  {value === ALL_LOCATIONS_VALUE && (
                    <span className="text-tn-gold">
                      <CheckIcon />
                    </span>
                  )}
                </button>
              )}

              {filteredLocations.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => select(loc.id)}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 border-none bg-transparent px-4 py-2.5 text-left font-sans text-[13px] font-medium text-tn-ink-soft hover:bg-tn-page"
                >
                  <span className="truncate">{loc.name}</span>
                  {value === loc.id && (
                    <span className="shrink-0 text-tn-gold">
                      <CheckIcon />
                    </span>
                  )}
                </button>
              ))}

              {!showAllOption && filteredLocations.length === 0 && (
                <p className="m-0 px-4 py-3 font-sans text-[13px] text-tn-muted-5">
                  No locations match "{query}"
                </p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export default LocationFilterPopover;
