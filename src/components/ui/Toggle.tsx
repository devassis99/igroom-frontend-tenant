interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** e.g. Locations' primary-location row, which the backend always rejects deactivating — greys out the switch instead of letting the click round-trip to an error. */
  disabled?: boolean;
}

/** The label + pill switch row used throughout Add/Edit Service and staff Options. */
export function Toggle({ checked, onChange, label, disabled = false }: ToggleProps) {
  return (
    <label className="flex items-center justify-between gap-3 py-1">
      <span className="font-sans text-[13px] font-medium text-tn-ink-soft">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={`relative h-[22px] w-9 flex-none rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? "bg-tn-gold" : "bg-tn-border-softer"
        }`}
      >
        {/*
          `left-0.5` is load-bearing, not decoration. With no `left`, an
          absolutely positioned box falls back to its *static* position —
          and a button centres its content, so the thumb's hypothetical box
          (zero-width, for this purpose) lands on the pill's midpoint, 18px
          in. Translating another 18px from there put the thumb at 36-54px
          on a 36px pill: fully outside it, drawing a surface-coloured
          circle over whatever sat to the right of the switch. On the
          Availability page that was the day name, so every label lost its
          first letter and the pill looked like a solid blob with no knob.
          Anchoring left and travelling the real distance (36 - 18 - 2 - 2)
          keeps it inside the pill at both ends.
        */}
        <span
          className={`absolute top-0.5 left-0.5 h-[18px] w-[18px] rounded-full bg-tn-surface transition-transform ${
            checked ? "translate-x-[14px]" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}

export default Toggle;
