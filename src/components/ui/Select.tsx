import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { useAnchoredPanel } from "@/components/ui/use-anchored-panel";

export interface SelectOption<T extends string | number> {
  value: T;
  label: string;
}

interface SelectProps<T extends string | number> {
  value: T;
  options: ReadonlyArray<SelectOption<T>>;
  onChange: (value: T) => void;
  /** Accessible name. The visible field label above usually says the same thing. */
  label: string;
  disabled?: boolean;
  className?: string;
}

// Must match the tn-popover-in/out keyframes in index.css, same as TimePicker.
const POPOVER_OPEN_MS = 150;
const POPOVER_CLOSE_MS = 120;
/** Floor for the panel width; otherwise it matches the field it hangs off. */
const MIN_PANEL_WIDTH = 140;
/** How long a pause ends a typed search ("ha" for Haircut vs "h" then "a"). */
const TYPEAHEAD_RESET_MS = 600;

function ChevronIcon({ className = "" }: { className?: string }) {
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
      className={className}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/**
 * A dropdown in the app's own style, in place of a native `<select>`.
 *
 * A native select opens the operating system's menu (on a Mac, a grey
 * floating list with a black tick), which is the one part of a form that
 * ignores the theme. This keeps the field looking like the inputs around it
 * and opens a panel styled like TimePicker's: cream surface, the chosen
 * option in gold with a check.
 *
 * It behaves like a select: a "select-only combobox" in ARIA terms. Focus
 * stays on the field while the list is open; the arrow keys, Home and End
 * move through it; Enter or Space picks; Escape closes without closing a
 * modal the field sits in; typing jumps to a matching option, open or
 * closed, the way a native select does.
 */
export function Select<T extends string | number>({
  value,
  options,
  onChange,
  label,
  disabled = false,
  className = "",
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  // Separate from `open` so the panel stays mounted while it animates out.
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ text: "", at: 0 });
  const id = useId();
  const listId = `${id}-list`;
  const optionId = (index: number) => `${id}-option-${index}`;

  const position = useAnchoredPanel(mounted, anchorRef, {
    width: "anchor",
    minWidth: MIN_PANEL_WIDTH,
    minHeight: 160,
  });
  const positioned = position !== null;

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  function openList() {
    setMounted(true);
    setClosing(false);
    setOpen(true);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }

  function closeList() {
    setOpen(false);
    setClosing(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    closeList();
  }

  // Unmounts the panel once its closing animation has played.
  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, POPOVER_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [closing]);

  // A click anywhere else, or the window changing size, closes the list.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      setOpen(false);
      setClosing(true);
    }
    function onResize() {
      setOpen(false);
      setClosing(true);
    }
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  // Keeps the highlighted option in view as the arrow keys move it. Sets
  // scrollTop rather than calling scrollIntoView, which would also scroll
  // the page behind this fixed panel (see TimePicker).
  useEffect(() => {
    if (!open || !positioned || activeIndex < 0) return;
    const list = listRef.current;
    const row = list?.children[activeIndex] as HTMLElement | undefined;
    if (!list || !row) return;
    if (row.offsetTop < list.scrollTop) {
      list.scrollTop = row.offsetTop - 6;
    } else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight + 6;
    }
  }, [open, positioned, activeIndex]);

  /** Index of the next option whose label starts with what's been typed, or -1. */
  function findTyped(key: string): number {
    const now = Date.now();
    const state = typeahead.current;
    state.text = now - state.at > TYPEAHEAD_RESET_MS ? key : state.text + key;
    state.at = now;
    const from = open ? activeIndex : selectedIndex;
    // A single letter steps to the *next* match, so pressing it again cycles.
    const offset = state.text.length === 1 ? 1 : 0;
    for (let step = 0; step < options.length; step++) {
      const index = (from + offset + step + options.length) % options.length;
      if (options[index]?.label.toLowerCase().startsWith(state.text)) return index;
    }
    return -1;
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>) {
    const printable = e.key.length === 1 && e.key !== " " && !e.metaKey && !e.ctrlKey && !e.altKey;
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openList();
      } else if (printable) {
        const index = findTyped(e.key.toLowerCase());
        const option = index >= 0 ? options[index] : undefined;
        if (option) onChange(option.value);
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(options.length - 1, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (activeIndex >= 0) choose(activeIndex);
        break;
      case "Escape":
        // Only the list closes. Without stopping it here, the Modal's own
        // Escape listener on window would close the whole form as well.
        e.preventDefault();
        e.stopPropagation();
        closeList();
        break;
      case "Tab":
        closeList();
        break;
      default:
        if (printable) {
          const index = findTyped(e.key.toLowerCase());
          if (index >= 0) setActiveIndex(index);
        }
    }
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        // A native <select> is what this replaces; its menu can't be styled.
        // eslint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        disabled={disabled}
        onClick={() => (open ? closeList() : openList())}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (open) closeList();
        }}
        className={`flex min-h-[46px] w-full cursor-pointer items-center justify-between gap-2 rounded-xl bg-tn-surface px-3.5 py-3 text-left font-sans text-sm text-tn-ink disabled:cursor-not-allowed disabled:opacity-60 ${
          open ? "border-2 border-tn-gold" : "border border-tn-input-border"
        } ${className}`}
        // Closed, keyboard focus gets the app's gold ring (index.css). Open,
        // the gold border already says where you are, and the ring around
        // it would make a double outline.
        style={open ? { outline: "none" } : undefined}
      >
        <span className="truncate">{selected?.label ?? ""}</span>
        <ChevronIcon
          className={`shrink-0 text-tn-muted-5 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {mounted &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            className={`fixed z-[60] flex flex-col overflow-hidden rounded-2xl border border-tn-border bg-tn-surface ${closing ? "pointer-events-none" : ""}`}
            style={{
              top: position.top,
              bottom: position.bottom,
              left: position.left,
              width: position.width,
              maxHeight: Math.min(position.maxHeight, 320),
              transformOrigin: position.placement === "above" ? "bottom left" : "top left",
              boxShadow: "0 20px 45px -15px rgba(20,15,5,0.35)",
              animation: closing
                ? `tn-popover-out ${POPOVER_CLOSE_MS}ms ease-in forwards`
                : `tn-popover-in ${POPOVER_OPEN_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            }}
          >
            <div
              ref={listRef}
              id={listId}
              // A native <select>/<option> is what this replaces; its menu can't be styled.
              // eslint-disable-next-line jsx-a11y/prefer-tag-over-role
              role="listbox"
              aria-label={label}
              className="min-h-0 flex-1 overflow-y-auto p-1.5"
            >
              {options.map((option, index) => {
                const isSelected = index === selectedIndex;
                const isActive = index === activeIndex;
                return (
                  // Keyboard use goes through the combobox's onKeyDown, with
                  // focus left on the field, so the options only need a click.
                  // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                  <div
                    key={String(option.value)}
                    id={optionId(index)}
                    // eslint-disable-next-line jsx-a11y/prefer-tag-over-role
                    role="option"
                    aria-selected={isSelected}
                    // Never a tab stop: focus stays on the field (see aria-activedescendant).
                    tabIndex={-1}
                    // Keeps focus on the field, so it doesn't blur and close first.
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(index)}
                    className={`flex h-9 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 font-sans text-[14px] ${
                      isSelected ? "font-semibold text-tn-gold" : "font-medium text-tn-ink-soft"
                    } ${isSelected ? "bg-tn-gold-bg-soft" : isActive ? "bg-tn-page" : ""}`}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected && <CheckIcon />}
                  </div>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export default Select;
