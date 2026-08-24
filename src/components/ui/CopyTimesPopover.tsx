import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";

interface CopyTimesPopoverProps {
  /** JS day-of-week (0 = Sunday) whose hours are being copied. Always shown ticked and locked — it is the source, not a destination. */
  sourceDay: number;
  /** Day labels indexed by JS day-of-week, and the order to list them in — passed in so this doesn't re-declare the caller's Monday-first ordering. */
  dayLabels: string[];
  displayOrder: number[];
  /** Receives the chosen days (never including `sourceDay`). Only fired on Apply — ticking a box changes nothing until then. */
  onApply: (targetDays: number[]) => void;
}

const PANEL_WIDTH = 232;
const GAP = 6;
const VIEWPORT_MARGIN = 8;

/**
 * Anchored below the trigger, then pulled back inside the viewport. Unlike
 * the filter popovers at the top of the page, this one hangs off a small
 * icon partway down a row that can sit close to the right-hand edge, so
 * left-aligning it unclamped would push the panel off screen.
 */
function useAnchoredPosition(open: boolean, anchorRef: RefObject<HTMLElement | null>) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setPosition(null);
      return;
    }
    const rect = anchorRef.current.getBoundingClientRect();
    const maxLeft = window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN;
    setPosition({
      top: rect.bottom + GAP,
      left: Math.max(VIEWPORT_MARGIN, Math.min(rect.left, maxLeft)),
    });
  }, [open, anchorRef]);

  return position;
}

function CopyIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

/**
 * "Copy times to…" — pick which days receive this day's hours.
 *
 * Replaces a one-click button that copied onto all six other days at once.
 * That was destructive and unrecoverable: a shop open late on Saturday
 * lost those hours the moment someone copied a weekday over them, with no
 * undo short of retyping. Choosing the destinations makes the common case
 * (weekdays alike, weekend different) one gesture instead of one-then-fix.
 *
 * Selection is local state and only leaves on Apply, so opening the panel,
 * ticking boxes and dismissing it changes nothing — and the boxes reset
 * each time it opens rather than remembering a half-made choice from
 * whenever it was last used.
 */
export function CopyTimesPopover({
  sourceDay,
  dayLabels,
  displayOrder,
  onApply,
}: CopyTimesPopoverProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const position = useAnchoredPosition(open, anchorRef);

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

  // Reset here rather than in an effect keyed on `open`: the boxes are
  // knowable at the moment of the click, and setting state from an effect
  // costs an extra render (and trips oxlint's react/set-state-in-effect).
  function toggleOpen() {
    if (!open) setSelected([]);
    setOpen(!open);
  }

  function toggle(day: number) {
    setSelected((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function apply() {
    onApply(selected);
    setOpen(false);
  }

  const sourceLabel = dayLabels[sourceDay] ?? "";

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={toggleOpen}
        title="Copy these hours to other days"
        aria-label={`Copy ${sourceLabel}'s hours to other days`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`cursor-pointer rounded-md border-none bg-transparent px-1 ${
          open ? "text-tn-ink" : "text-tn-muted-5 hover:text-tn-ink"
        }`}
      >
        <CopyIcon />
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            aria-label={`Copy ${sourceLabel}'s hours to other days`}
            className="fixed z-50 overflow-hidden rounded-2xl border border-tn-border bg-tn-surface"
            style={{
              top: position.top,
              left: position.left,
              width: PANEL_WIDTH,
              boxShadow: "0 20px 45px -15px rgba(20,15,5,0.35)",
            }}
          >
            <p className="m-0 px-4 pt-3 pb-2 font-sans text-[11px] font-semibold tracking-[0.04em] text-tn-faint">
              COPY TIMES TO
            </p>

            <div className="flex flex-col">
              {displayOrder.map((day) => {
                const isSource = day === sourceDay;
                const isChecked = isSource || selected.includes(day);
                return (
                  <label
                    key={day}
                    className={`flex items-center justify-between gap-3 px-4 py-2 font-sans text-[13px] ${
                      isSource
                        ? "cursor-default text-tn-muted-5"
                        : "cursor-pointer text-tn-ink-soft hover:bg-tn-page"
                    }`}
                  >
                    <span>{dayLabels[day]}</span>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isSource}
                      onChange={() => toggle(day)}
                      className="size-4 shrink-0 accent-tn-gold"
                    />
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end border-t border-tn-border-soft px-4 py-2.5">
              <Button size="sm" onClick={apply} disabled={selected.length === 0}>
                Apply
              </Button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export default CopyTimesPopover;
