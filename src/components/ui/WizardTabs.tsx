interface WizardTabsProps {
  steps: string[];
  activeIndex: number;
  /**
   * Omit for the Add Member wizard, where the tabs are a read-only
   * progress indicator and Back/Next drive the step. EditMemberModal
   * passes one because every tab there is independently reachable — an
   * owner editing an existing member has no ordered flow to walk.
   */
  onSelect?: (index: number) => void;
}

function labelClass(i: number, activeIndex: number): string {
  if (i === activeIndex) return "font-semibold text-tn-ink";
  return i < activeIndex ? "font-medium text-tn-gold" : "font-medium text-tn-faint-2";
}

/** Step labels across the top of the Add Member wizard (Profile / Services / Schedule / Role / Options) and, in the interactive `onSelect` form, EditMemberModal's tabs. */
export function WizardTabs({ steps, activeIndex, onSelect }: WizardTabsProps) {
  return (
    <div
      className="flex gap-5 border-b border-tn-border-soft pb-3"
      role={onSelect ? "tablist" : undefined}
    >
      {steps.map((step, i) =>
        onSelect ? (
          <button
            key={step}
            type="button"
            role="tab"
            aria-selected={i === activeIndex}
            onClick={() => onSelect(i)}
            className={`cursor-pointer border-none bg-transparent p-0 font-sans text-[13px] ${
              // The interactive form never uses the "already walked past
              // it" gold state — with no ordered flow, a tab is either
              // the one you're on or one you could switch to.
              i === activeIndex ? "font-semibold text-tn-ink" : "font-medium text-tn-faint-2"
            }`}
          >
            {step}
          </button>
        ) : (
          <span key={step} className={`font-sans text-[13px] ${labelClass(i, activeIndex)}`}>
            {step}
          </span>
        ),
      )}
    </div>
  );
}

export default WizardTabs;
