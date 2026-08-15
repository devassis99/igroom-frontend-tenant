interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** The pill-shaped toggle used for List/Board, Day/Week/Month, and the billing-cycle tabs. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="flex gap-0.5 rounded-full bg-tn-page p-[3px]">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-full px-3.5 py-1.5 font-sans text-xs ${
            option.value === value
              ? "bg-tn-dark font-semibold text-tn-on-dark"
              : "font-medium text-tn-muted-5"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default SegmentedControl;
