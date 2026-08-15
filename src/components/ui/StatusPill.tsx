import type { ReactNode } from "react";

const TONE_CLASSES = {
  success: "bg-tn-success-bg text-tn-success",
  danger: "bg-tn-danger-bg text-tn-danger",
  neutral: "bg-tn-neutral-bg text-tn-muted-3",
  gold: "bg-tn-gold-bg text-tn-gold",
  blue: "bg-tn-blue-bg text-tn-blue",
} as const;

interface StatusPillProps {
  tone: keyof typeof TONE_CLASSES;
  children: ReactNode;
}

/** Matches the rounded status badge used in every table/list across the mockup (Confirmed, VIP, Active, ...). */
export function StatusPill({ tone, children }: StatusPillProps) {
  return (
    <span
      className={`w-fit rounded-full px-[9px] py-[3px] font-sans text-[11px] font-semibold whitespace-nowrap ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}

export default StatusPill;
