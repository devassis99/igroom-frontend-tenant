interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

/** The label + pill switch row used throughout Add/Edit Service and staff Options. */
export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <label className="flex items-center justify-between gap-3 py-1">
      <span className="font-sans text-[13px] font-medium text-tn-ink-soft">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-[22px] w-9 flex-none rounded-full transition-colors ${
          checked ? "bg-tn-gold" : "bg-tn-border-softer"
        }`}
      >
        <span
          className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-tn-surface transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

export default Toggle;
