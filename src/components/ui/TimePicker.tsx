import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

interface TimePickerProps {
  /** "HH:mm" (24-hour), or "" for no time picked yet. */
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

const GAP = 6;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
// 5-minute steps rather than every one of the 60 — matches how booking
// slots actually get scheduled in practice and keeps the column short
// enough to scan instead of the native picker's full 00-59 scroll.
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

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
 * Replaces the native `<input type="time">` (whose scroll-wheel popup is
 * the OS/browser's own blue-accented UI, not this app's) with an in-app
 * hour/minute picker — same portal/getBoundingClientRect positioning,
 * outside-click/Escape/resize-close, and gold-accent-on-selection styling
 * as DatePicker.tsx, so the two paired "Staff & Time" fields read as one
 * family instead of one custom control next to one native one. Value
 * stays a plain "HH:mm" 24-hour string, same as the input it replaces —
 * no caller-visible change beyond the picker UI itself.
 */
export function TimePicker({ value, onChange, label = "Time", className = "" }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const parsed = parseValue(value);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);
  const position = useAnchoredPosition(open, anchorRef);

  // Scroll the currently-picked hour/minute into view every time the
  // popover opens, rather than always starting the columns at the top.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      hourListRef.current
        ?.querySelector('[aria-selected="true"]')
        ?.scrollIntoView({ block: "center" });
      minuteListRef.current
        ?.querySelector('[aria-selected="true"]')
        ?.scrollIntoView({ block: "center" });
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

  function selectHour(hour: number) {
    onChange(`${pad2(hour)}:${pad2(parsed?.minute ?? 0)}`);
  }

  function selectMinute(minute: number) {
    onChange(`${pad2(parsed?.hour ?? 0)}:${pad2(minute)}`);
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
              width: 176,
              boxShadow: "0 20px 45px -15px rgba(20,15,5,0.35)",
            }}
          >
            <div className="grid grid-cols-2 divide-x divide-tn-border-soft">
              <div ref={hourListRef} className="max-h-56 overflow-y-auto py-1.5">
                {HOURS.map((hour) => {
                  const isSelected = parsed?.hour === hour;
                  return (
                    <button
                      key={hour}
                      type="button"
                      onClick={() => selectHour(hour)}
                      className={`flex w-full cursor-pointer items-center justify-center border-none bg-transparent py-2 font-sans text-[13px] ${
                        isSelected
                          ? "font-semibold text-tn-gold"
                          : "font-medium text-tn-ink-soft hover:bg-tn-page"
                      }`}
                    >
                      {pad2(hour)}
                    </button>
                  );
                })}
              </div>
              <div ref={minuteListRef} className="max-h-56 overflow-y-auto py-1.5">
                {MINUTES.map((minute) => {
                  const isSelected = parsed?.minute === minute;
                  return (
                    <button
                      key={minute}
                      type="button"
                      onClick={() => selectMinute(minute)}
                      className={`flex w-full cursor-pointer items-center justify-center border-none bg-transparent py-2 font-sans text-[13px] ${
                        isSelected
                          ? "font-semibold text-tn-gold"
                          : "font-medium text-tn-ink-soft hover:bg-tn-page"
                      }`}
                    >
                      {pad2(minute)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export default TimePicker;
