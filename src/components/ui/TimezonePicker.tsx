import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

interface TimezonePickerProps {
  value: string;
  onChange: (timezone: string) => void;
  label?: string;
}

const PANEL_WIDTH = 300;
const GAP = 6;
const MAX_VISIBLE = 60;

// Intl.supportedValuesOf("timeZone") returns the full IANA tz database
// (~400 ids) and doesn't change during a session — compute it once at
// module load rather than per render/keystroke. Falls back to just UTC on
// a runtime old enough not to support the call (Safari < 15.4-ish).
const ALL_ZONES: string[] = (() => {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC"];
  }
})();

function friendlyLabel(zone: string): string {
  const last = zone.split("/").pop() ?? zone;
  return last.replace(/_/g, " ");
}

function currentTimeIn(zone: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: zone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date());
  } catch {
    return "";
  }
}

/** e.g. "UTC+1", "UTC+5:30", "UTC" — the offset row/button labels asked for, so zones can be told apart (and sorted mentally) at a glance instead of just by city name. */
function utcOffsetLabel(zone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    return raw.replace("GMT", "UTC") || "UTC";
  } catch {
    return "";
  }
}

function GlobeIcon() {
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
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
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
 * The reference Working Hours page's editable "Timezone" field — a
 * searchable dropdown over the full IANA tz database, each row showing
 * the current time in that zone, rather than a plain text input. This is
 * this *schedule's own* timezone (see availability.service.ts's
 * staff_availability_settings table), independent of the staff member's
 * location — HoursSettingsPage.tsx seeds `value` from the saved setting,
 * falling back to the location's own timezone, then the browser's, but
 * once the user picks one here it's an explicit override either way.
 *
 * Portaled to document.body and positioned from the trigger's own
 * getBoundingClientRect(), same reasoning as LocationFilterPopover.tsx /
 * StaffFilterPopover.tsx.
 */
export function TimezonePicker({ value, onChange, label = "Timezone" }: TimezonePickerProps) {
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

  const filteredZones = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? ALL_ZONES.filter(
          (zone) => zone.toLowerCase().includes(q) || friendlyLabel(zone).toLowerCase().includes(q),
        )
      : ALL_ZONES;
    return { shown: matches.slice(0, MAX_VISIBLE), total: matches.length };
  }, [query]);

  function select(zone: string) {
    onChange(zone);
    setOpen(false);
  }

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
          <GlobeIcon />
        </span>
        <span className="max-w-[220px] truncate">
          {friendlyLabel(value)} ({utcOffsetLabel(value)}, {currentTimeIn(value)})
        </span>
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

            <div className="max-h-72 overflow-y-auto border-t border-tn-border-soft py-1.5">
              {filteredZones.shown.map((zone) => (
                <button
                  key={zone}
                  type="button"
                  onClick={() => select(zone)}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 border-none bg-transparent px-4 py-2.5 text-left font-sans text-[13px] font-medium text-tn-ink-soft hover:bg-tn-page"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      {friendlyLabel(zone)} ({utcOffsetLabel(zone)}, {currentTimeIn(zone)})
                    </span>
                    <span className="block truncate font-normal text-tn-muted-5">{zone}</span>
                  </span>
                  {value === zone && (
                    <span className="shrink-0 text-tn-gold">
                      <CheckIcon />
                    </span>
                  )}
                </button>
              ))}

              {filteredZones.shown.length === 0 && (
                <p className="m-0 px-4 py-3 font-sans text-[13px] text-tn-muted-5">
                  No timezones match "{query}"
                </p>
              )}

              {filteredZones.total > filteredZones.shown.length && (
                <p className="m-0 px-4 py-2 font-sans text-xs text-tn-muted-5">
                  {filteredZones.total - filteredZones.shown.length} more — keep typing to narrow it
                  down
                </p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export default TimezonePicker;
