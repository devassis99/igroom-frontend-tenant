import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/components/ui/Avatar";

interface StaffOption {
  id: string;
  name: string;
}

interface StaffFilterPopoverProps {
  staff: StaffOption[];
  value: string;
  onChange: (value: string) => void;
  /** Id of the signed-in staff user — their own row gets a "(me)" suffix, matching the old <select>'s option label. */
  selfId?: string;
  label?: string;
}

const PANEL_WIDTH = 260;
const GAP = 6;

// Same deterministic id->color hash as StaffPage.tsx/StaffManagementPage.tsx
// /CustomersPage.tsx, duplicated here rather than newly shared so a given
// staff member keeps landing on the same avatar color everywhere without
// this popover reaching into an unrelated page's module.
const AVATAR_COLORS = [
  "var(--color-tn-avatar-peach)",
  "var(--color-tn-avatar-tan)",
  "var(--color-tn-avatar-cream)",
  "var(--color-tn-avatar-brown)",
  "var(--color-tn-avatar-blue)",
];

function avatarColorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

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
 * Staff filter for Settings > Availability, styled after the same
 * reference "Filter scheduler" popover as LocationFilterPopover.tsx —
 * see that component's doc comment for why this is portaled rather than a
 * plain absolutely-positioned child. Kept as its own component instead of
 * genericizing LocationFilterPopover because the row content differs
 * (avatar + name here vs. plain text there) and there's no "All staff"
 * option — Availability always shows exactly one person's schedule.
 */
export function StaffFilterPopover({
  staff,
  value,
  onChange,
  selfId,
  label = "Filter by member",
}: StaffFilterPopoverProps) {
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

  const selected = staff.find((s) => s.id === value);
  const selectedName = selected
    ? selected.id === selfId
      ? `${selected.name} (me)`
      : selected.name
    : "Select member";

  function select(next: string) {
    onChange(next);
    setOpen(false);
  }

  const filteredStaff = query.trim()
    ? staff.filter((member) => member.name.toLowerCase().includes(query.trim().toLowerCase()))
    : staff;

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
        <span className="max-w-[140px] truncate">{selectedName}</span>
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
              {filteredStaff.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => select(member.id)}
                  className="flex w-full cursor-pointer items-center gap-2.5 border-none bg-transparent px-4 py-2 text-left font-sans text-[13px] font-medium text-tn-ink-soft hover:bg-tn-page"
                >
                  <Avatar
                    initials={initialsFor(member.name)}
                    color={avatarColorFor(member.id)}
                    size={26}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {member.name}
                    {member.id === selfId && " (me)"}
                  </span>
                  {value === member.id && (
                    <span className="shrink-0 text-tn-gold">
                      <CheckIcon />
                    </span>
                  )}
                </button>
              ))}

              {filteredStaff.length === 0 && (
                <p className="m-0 px-4 py-3 font-sans text-[13px] text-tn-muted-5">
                  No members match "{query}"
                </p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export default StaffFilterPopover;
