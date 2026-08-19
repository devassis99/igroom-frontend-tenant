import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import type { OwnerAccount } from "@/auth/types";

interface AccountMenuProps {
  open: boolean;
  onClose: () => void;
  owner: OwnerAccount | null;
  onSettingsClick: () => void;
  onLogOut: () => void;
  /** The trigger button's ref — measured to position the portal (see the component doc comment for why this can't just be an absolutely-positioned child). */
  anchorRef: RefObject<HTMLElement | null>;
}

const MENU_WIDTH = 260;
const GAP = 8;

function GearIcon() {
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
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 17l5-5-5-5M21 12H9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MenuRow({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-3 border-none bg-transparent px-4 py-2.5 text-left font-sans text-[13px] font-medium text-tn-ink-soft hover:bg-tn-page"
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-tn-muted-5">
        {icon}
      </span>
      {label}
    </button>
  );
}

/**
 * Popover triggered by the sidebar's owner identity row (see AppShell.tsx)
 * — matches the reference account-menu screenshot: bold name + email
 * header, an "ORGANIZATION" section (shop name, no switcher — an iGroom
 * owner belongs to exactly one account, unlike the reference app's
 * multi-org switcher), then action rows.
 *
 * The reference screenshot also has "Become an affiliate" and "Knowledge
 * base" rows, but neither is a real iGroom feature yet, so this only
 * ships Settings + Sign Out — add rows here once those features exist
 * instead of linking them to nothing.
 *
 * Rendered through a portal to document.body and positioned from the
 * trigger's own getBoundingClientRect() rather than as a normal
 * absolutely-positioned child of the sidebar: the `<aside>` sets
 * overflow-x-hidden (needed so its collapse-width transition doesn't
 * show a horizontal scrollbar), which was silently clipping this menu's
 * right edge since it's wider than the sidebar itself. Opens *upward*
 * (anchored above the trigger, not below) because the trigger sits at
 * the very bottom of the sidebar — anchoring downward would push most of
 * the menu off-screen.
 */
export function AccountMenu({
  open,
  onClose,
  owner,
  onSettingsClick,
  onLogOut,
  anchorRef,
}: AccountMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; bottom: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setPosition(null);
      return;
    }
    const rect = anchorRef.current.getBoundingClientRect();
    setPosition({ left: rect.left, bottom: window.innerHeight - rect.top + GAP });
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    // A resize is the one thing likely to invalidate the measured
    // position while the menu is open (e.g. the window itself resizing);
    // simplest correct behavior is to just close rather than re-measure.
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onClose);
    };
  }, [open, onClose]);

  if (!open || !owner || !position) return null;

  return createPortal(
    <div
      ref={rootRef}
      role="menu"
      aria-label="Account menu"
      className="fixed z-50 overflow-hidden rounded-2xl border border-tn-border bg-tn-surface"
      style={{
        left: position.left,
        bottom: position.bottom,
        width: MENU_WIDTH,
        boxShadow: "0 20px 45px -15px rgba(20,15,5,0.35)",
      }}
    >
      <div className="px-4 pb-3 pt-4">
        <p className="m-0 truncate font-sans text-sm font-semibold text-tn-ink">{owner.fullName}</p>
        <p className="m-0 mt-0.5 truncate font-sans text-xs text-tn-muted-5">{owner.workEmail}</p>
      </div>

      <div className="border-t border-tn-border-soft px-4 py-3">
        <p className="m-0 mb-2 font-sans text-[10px] font-semibold tracking-[0.06em] text-tn-faint">
          ORGANIZATION
        </p>
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[oklch(90%_0.03_20)] font-sans text-[11px] font-semibold text-tn-ink">
            {owner.businessName?.[0]?.toUpperCase() ?? "?"}
          </div>
          <span className="truncate font-sans text-[13px] font-medium text-tn-ink">
            {owner.businessName}
          </span>
        </div>
      </div>

      <div className="border-t border-tn-border-soft py-1.5">
        <MenuRow icon={<GearIcon />} label="Settings" onClick={onSettingsClick} />
      </div>

      <div className="border-t border-tn-border-soft py-1.5">
        <MenuRow icon={<SignOutIcon />} label="Sign Out" onClick={onLogOut} />
      </div>
    </div>,
    document.body,
  );
}

export default AccountMenu;
