import type { ButtonHTMLAttributes } from "react";

const VARIANT_CLASSES = {
  primary: "border-none bg-tn-dark text-tn-on-dark hover:opacity-90",
  secondary: "border border-tn-input-border bg-transparent text-tn-ink-soft hover:bg-tn-page",
  danger: "border-none bg-tn-danger-strong text-tn-on-dark hover:opacity-90",
  ghost: "border-none bg-transparent text-tn-gold hover:underline",
} as const;

const SIZE_CLASSES = {
  sm: "rounded-lg px-3.5 py-2 text-xs",
  md: "rounded-[10px] px-[18px] py-[11px] text-[13px]",
  lg: "rounded-xl px-7 py-[15px] text-[15px]",
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANT_CLASSES;
  size?: keyof typeof SIZE_CLASSES;
}

/** Shared button styling so every CTA across the app (mostly `bg-tn-dark` pills) stays in sync. */
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`cursor-pointer font-sans font-semibold ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    />
  );
}

export default Button;
