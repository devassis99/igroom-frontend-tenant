import type { ReactNode } from "react";

/** Shared label+control wrapper, matches the mockup's uppercase-label input pattern throughout. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-sans text-xs font-medium tracking-[0.02em] text-tn-muted-1">
        {label}
      </span>
      {children}
    </label>
  );
}

export const formInputClass =
  "rounded-xl border border-tn-input-border bg-tn-surface px-3.5 py-3 font-sans text-sm text-tn-ink outline-none focus:border-2 focus:border-tn-gold placeholder:text-tn-placeholder";

/**
 * The height a formInputClass control comes out at (px-3.5 py-3 around
 * text-sm, plus its border). Controls in the same row that aren't plain
 * inputs — a popover trigger, a box wrapped around a toggle — size their
 * own content and so land a few pixels short or over; pinning them to
 * this keeps a row of mixed controls on one baseline.
 */
export const formControlHeightClass = "min-h-[46px]";

export const formSelectClass =
  "rounded-xl border border-tn-input-border bg-tn-surface px-3.5 py-3 font-sans text-sm text-tn-ink outline-none focus:border-2 focus:border-tn-gold";

export default Field;
