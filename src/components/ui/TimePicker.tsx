import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAnchoredPanel } from "@/components/ui/use-anchored-panel";

interface TimePickerProps {
  /** "HH:mm" (24-hour), or "" for no time picked yet. */
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

/**
 * Floor for the panel width — it otherwise matches the trigger it hangs
 * off, via useAnchoredPanel's "anchor" width. The width used to be a
 * hardcoded 152px, wider than the compact 132px fields on the availability
 * grid, which left a strip of empty panel past each field's right edge.
 * This floor only catches a trigger too narrow to fit a formatted time.
 */
const MIN_PANEL_WIDTH = 120;
// Close duration must match the tn-popover-out keyframe's own duration
// (see index.css) — this is what keeps the panel mounted long enough for
// that animation to actually finish playing before it's removed.
const POPOVER_OPEN_MS = 150;
const POPOVER_CLOSE_MS = 120;

// A single flat list of every "HH:mm" 24-hour slot, 15 minutes apart
// (00:00, 00:15, 00:30 … 23:45 — 96 entries) — one scrollable column of
// full times to click, rather than two side-by-side hour/minute columns
// you had to combine yourself. 15 minutes (not 5, like the old minute
// column) keeps that one list a reasonable length to scroll.
const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => {
  const totalMinutes = i * 15;
  return `${pad2(Math.floor(totalMinutes / 60))}:${pad2(totalMinutes % 60)}`;
});

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseValue(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function formatDisplay(hour: number, minute: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelveHour}:${pad2(minute)} ${period}`;
}

function ClockIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14.5" />
    </svg>
  );
}

/**
 * Replaces the native `<input type="time">` (whose scroll-wheel popup is
 * the OS/browser's own blue-accented UI, not this app's) with an in-app
 * time picker — a single scrollable list of 15-minute slots (00:00 through
 * 23:45) you click once, rather than combining separate hour/minute
 * columns. Same portal/getBoundingClientRect positioning,
 * outside-click/Escape/resize-close, and gold-accent-on-selection styling
 * as DatePicker.tsx, so the two paired "Staff & Time" fields read as one
 * family instead of one custom control next to one native one. Value
 * stays a plain "HH:mm" 24-hour string, same as the input it replaces —
 * no caller-visible change beyond the picker UI itself.
 */
export function TimePicker({ value, onChange, label = "Time", className = "" }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  // Separate from `open` so the panel can stay in the DOM — and keep
  // animating — for the brief window after `open` flips false. Without
  // this the portal below would unmount the instant `open` goes false,
  // which is what made the popover pop in but just vanish on close.
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const parsed = parseValue(value);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const position = useAnchoredPanel(mounted, anchorRef, {
    width: "anchor",
    minWidth: MIN_PANEL_WIDTH,
    minHeight: 200,
  });

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mounted) return;
    setClosing(true);
    const timer = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, POPOVER_CLOSE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when `open` itself flips; `mounted` is read for its current value below, not tracked as a trigger
  }, [open]);

  // Scroll the currently-picked time into view every time the popover
  // opens, rather than always starting the list at 00:00.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      listRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(raf);
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

  function selectTime(time: string) {
    onChange(time);
    setOpen(false);
  }

  const displayValue = parsed ? formatDisplay(parsed.hour, parsed.minute) : "Select a time";

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border bg-tn-surface px-3.5 py-3 text-left font-sans text-sm text-tn-ink outline-none ${
          open ? "border-2 border-tn-gold" : "border border-tn-input-border"
        } ${className}`}
      >
        <span className={parsed ? "" : "text-tn-placeholder"}>{displayValue}</span>
        <span className="shrink-0 text-tn-muted-5">
          <ClockIcon />
        </span>
      </button>

      {mounted &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            aria-label={label}
            className={`fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-tn-border bg-tn-surface ${closing ? "pointer-events-none" : ""}`}
            style={{
              top: position.top,
              bottom: position.bottom,
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
              transformOrigin: position.placement === "above" ? "bottom left" : "top left",
              boxShadow: "0 20px 45px -15px rgba(20,15,5,0.35)",
              animation: closing
                ? `tn-popover-out ${POPOVER_CLOSE_MS}ms ease-in forwards`
                : `tn-popover-in ${POPOVER_OPEN_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            }}
          >
            <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto py-1.5">
              {TIME_OPTIONS.map((time) => {
                const isSelected = value === time;
                const [hour = 0, minute = 0] = time.split(":").map(Number);
                return (
                  <button
                    key={time}
                    type="button"
                    // aria-current (not aria-selected — role-supports-aria-props
                    // rejects that on a plain <button>'s implicit role="button")
                    // flags the picked time for both assistive tech and the
                    // scroll-into-view effect above, which queries this same attribute.
                    aria-current={isSelected ? "true" : undefined}
                    onClick={() => selectTime(time)}
                    // Fixed h-8 (not padding + line-height) pins every row
                    // to exactly 32px regardless of "Work Sans"'s own font
                    // metrics — py-1.5 alone barely shrank the rows because
                    // the font's line-height was doing most of the work, so
                    // this locks row height down directly instead of fighting it.
                    className={`flex h-8 w-full cursor-pointer items-center justify-center border-none font-sans text-[13px] leading-none ${
                      isSelected
                        ? "bg-tn-gold-bg-soft font-semibold text-tn-gold"
                        : "bg-transparent font-medium text-tn-ink-soft hover:bg-tn-page"
                    }`}
                  >
                    {formatDisplay(hour, minute)}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export default TimePicker;
