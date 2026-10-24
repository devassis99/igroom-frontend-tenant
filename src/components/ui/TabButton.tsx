interface TabButtonProps {
  active: boolean;
  label: string;
  /** Shown as a small badge beside the label — "Members 3", "Past 52". */
  count?: number;
  onClick: () => void;
  /** `lg` for a tab bar that heads a whole view (the Calendar's list); `md` everywhere else. */
  size?: "md" | "lg";
}

/**
 * One tab in an underlined tab bar, in the app's selection colour: the open
 * tab is the logo's clay — deep clay text (the plain clay is too light to
 * read at this size) over a clay underline that draws itself in — the same
 * choice as the selected item in the main menu and the Settings menu. A
 * count, when there is one, is a small badge that takes the clay tint while
 * its tab is open.
 *
 * Shared so every tab bar in the app (Staff Management, a location's
 * detail pane, the Calendar's list) changes together. Put the buttons in a
 * row with `border-b border-tn-border-soft` and no bottom padding: the
 * underline sits on that border.
 */
export function TabButton({ active, label, count, onClick, size = "md" }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`relative flex cursor-pointer items-center gap-2 border-none bg-transparent px-3 py-3 font-sans transition-colors duration-150 ${
        size === "lg" ? "text-[16px]" : "text-[14px]"
      } ${
        active
          ? "font-semibold text-brand-clay-deep"
          : "font-medium text-tn-muted-5 hover:text-tn-ink-soft"
      }`}
    >
      {label}
      {count !== undefined && (
        <span
          className={`min-w-[22px] rounded-full px-1.5 py-px text-center text-[12px] font-semibold transition-colors duration-150 ${
            active ? "bg-brand-clay/12 text-brand-clay-deep" : "bg-tn-neutral-bg text-tn-muted-5"
          }`}
        >
          {count}
        </span>
      )}
      {/* Its own element rather than a border on the button, so it can
          animate its width in from the left — a border-bottom can only
          fade. Keyed by label so it replays on every switch. */}
      {active && (
        <span
          key={label}
          aria-hidden
          className="tn-underline-in absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-clay"
        />
      )}
    </button>
  );
}

export default TabButton;
