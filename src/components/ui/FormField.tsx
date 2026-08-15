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

export const formSelectClass =
  "rounded-xl border border-tn-input-border bg-tn-surface px-3.5 py-3 font-sans text-sm text-tn-ink outline-none focus:border-2 focus:border-tn-gold";

export default Field;
