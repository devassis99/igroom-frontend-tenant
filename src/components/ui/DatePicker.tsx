import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAnchoredPanel } from "@/components/ui/use-anchored-panel";

interface DatePickerProps {
  /** "YYYY-MM-DD", or "" for no date picked yet. */
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  /**
   * Earliest selectable day, "YYYY-MM-DD" — the native input's `min`
   * attribute, which this control replaced. Days before it are shown but
   * not clickable: hiding them entirely would leave a half-empty first
   * week that reads as a rendering fault, and greying them says "in the
   * past" the way a calendar normally does.
   */
  min?: string;
}

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatValue(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Parses "YYYY-MM-DD" as a local-time Date, not UTC — `new Date(value)` would parse it as UTC midnight and can land on the wrong day once displayed in a negative-offset timezone. */
function parseValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

interface Cell {
  date: Date;
  inMonth: boolean;
}

function buildGrid(viewDate: Date): Cell[] {
  const year = viewDate.getFullYear();
  const monthIndex = viewDate.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const total = daysInMonth(year, monthIndex);

  const cells: Cell[] = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ date: new Date(year, monthIndex, i - firstWeekday + 1), inMonth: false });
  }
  for (let d = 1; d <= total; d++) {
    cells.push({ date: new Date(year, monthIndex, d), inMonth: true });
  }
  while (cells.length < 42) {
    const last = cells[cells.length - 1]!.date;
    cells.push({
      date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
      inMonth: false,
    });
  }
  return cells;
}

function CalendarIcon() {
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
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

/**
 * Replaces the native `<input type="date">` (whose picker is the OS/
 * browser's own UI, not this app's, and reads inconsistently across
 * browsers) with an in-app month-grid calendar — same portal/
 * getBoundingClientRect positioning and outside-click/Escape/resize-close
 * pattern as LocationFilterPopover.tsx/TimezonePicker.tsx, so it behaves
 * like every other popover in the app instead of a native control. Value
 * stays a plain "YYYY-MM-DD" string, same as the input it replaces — no
 * caller-visible change beyond the picker UI itself.
 */
export function DatePicker({
  value,
  onChange,
  label = "Date",
  className = "",
  min,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseValue(value);
  const [viewDate, setViewDate] = useState(() => selected ?? new Date());
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const position = useAnchoredPanel(open, anchorRef, { width: 288, minHeight: 340 });

  // Jump the visible month back to whatever's selected (or today, if
  // nothing's picked yet) every time the popover opens, rather than
  // leaving it wherever it was left after a prior open/navigate.
  useEffect(() => {
    if (open) setViewDate(selected ?? new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function select(date: Date) {
    onChange(formatValue(date));
    setOpen(false);
  }

  function goMonth(delta: number) {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  const today = new Date();
  const minDate = min ? parseValue(min) : null;
  const cells = buildGrid(viewDate);
  const monthLabel = viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const displayValue = selected
    ? selected.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "Select a date";

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
        <span className={selected ? "" : "text-tn-placeholder"}>{displayValue}</span>
        <span className="shrink-0 text-tn-muted-5">
          <CalendarIcon />
        </span>
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            aria-label={label}
            className="fixed z-50 overflow-hidden rounded-2xl border border-tn-border bg-tn-surface p-3.5"
            style={{
              top: position.top,
              bottom: position.bottom,
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
              overflowY: "auto",
              boxShadow: "0 20px 45px -15px rgba(20,15,5,0.35)",
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => goMonth(-1)}
                aria-label="Previous month"
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-tn-muted-5 hover:bg-tn-page hover:text-tn-ink"
              >
                <ChevronLeftIcon />
              </button>
              <p className="m-0 font-sans text-[13px] font-semibold text-tn-ink">{monthLabel}</p>
              <button
                type="button"
                onClick={() => goMonth(1)}
                aria-label="Next month"
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-tn-muted-5 hover:bg-tn-page hover:text-tn-ink"
              >
                <ChevronRightIcon />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-y-1">
              {WEEKDAY_LABELS.map((wd) => (
                <span
                  key={wd}
                  className="flex h-7 items-center justify-center font-sans text-[11px] font-semibold text-tn-muted-5"
                >
                  {wd}
                </span>
              ))}

              {cells.map((cell) => {
                const isSelected = selected !== null && isSameDay(cell.date, selected);
                const isToday = isSameDay(cell.date, today);
                // Both sides are local midnight (see parseValue and
                // buildGrid), so a plain comparison is a day comparison.
                const isBlocked = minDate !== null && cell.date < minDate;
                return (
                  <button
                    key={cell.date.toISOString()}
                    type="button"
                    disabled={isBlocked}
                    onClick={() => select(cell.date)}
                    aria-current={isToday ? "date" : undefined}
                    className={`m-auto flex h-8 w-8 items-center justify-center rounded-full border-none font-sans text-[13px] ${
                      isBlocked
                        ? "cursor-not-allowed bg-transparent text-tn-faint-2"
                        : isSelected
                          ? "cursor-pointer bg-tn-gold font-semibold text-tn-on-dark"
                          : isToday
                            ? "cursor-pointer bg-tn-page font-semibold text-tn-ink"
                            : cell.inMonth
                              ? "cursor-pointer bg-transparent text-tn-ink-soft hover:bg-tn-page"
                              : "cursor-pointer bg-transparent text-tn-faint-2 hover:bg-tn-page"
                    }`}
                  >
                    {cell.date.getDate()}
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

export default DatePicker;
