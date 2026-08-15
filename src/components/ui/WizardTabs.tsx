interface WizardTabsProps {
  steps: string[];
  activeIndex: number;
}

/** Non-interactive step labels across the top of the Add Member wizard (Profile / Services / Schedule / Role / Options). */
export function WizardTabs({ steps, activeIndex }: WizardTabsProps) {
  return (
    <div className="flex gap-5 border-b border-tn-border-soft pb-3">
      {steps.map((step, i) => (
        <span
          key={step}
          className={`font-sans text-[13px] ${
            i === activeIndex
              ? "font-semibold text-tn-ink"
              : i < activeIndex
                ? "font-medium text-tn-gold"
                : "font-medium text-tn-faint-2"
          }`}
        >
          {step}
        </span>
      ))}
    </div>
  );
}

export default WizardTabs;
