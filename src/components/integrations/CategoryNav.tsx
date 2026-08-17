import type { Integration } from "@/lib/sample-data";

export type Category = "All Integrations" | Integration["category"];

/**
 * Shape rhythm intentionally mirrors AppShell's primary sidebar
 * (square, circle, square, square, circle, square, square) — the mockup
 * draws this nav as a visual echo of the main nav, not a coincidence.
 */
export const CATEGORIES: Array<{ label: Category; shape: "square" | "circle" }> = [
  { label: "All Integrations", shape: "square" },
  { label: "Communication", shape: "circle" },
  { label: "Scheduling", shape: "square" },
  { label: "Payments", shape: "square" },
  { label: "Marketing", shape: "circle" },
  { label: "Reviews", shape: "square" },
  { label: "Automation", shape: "square" },
];

export function CategoryIcon({ shape, active }: { shape: "square" | "circle"; active: boolean }) {
  return (
    <span
      className={`block h-3.5 w-3.5 shrink-0 ${shape === "circle" ? "rounded-full" : "rounded-[3px]"} ${
        active ? "bg-current" : "border-2 border-current"
      }`}
      aria-hidden
    />
  );
}

interface CategoryNavProps {
  value: Category;
  onChange: (category: Category) => void;
}

/** The left-column category list — shared by the Settings > Integrations page and the sidebar's Integrations modal. */
export function CategoryNav({ value, onChange }: CategoryNavProps) {
  return (
    <nav className="flex flex-col gap-0.5">
      {CATEGORIES.map((c) => {
        const active = value === c.label;
        return (
          <button
            key={c.label}
            type="button"
            onClick={() => onChange(c.label)}
            className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-left font-sans text-[13px] ${
              active
                ? "bg-tn-dark font-semibold text-tn-on-dark"
                : "font-medium text-tn-nav-inactive"
            }`}
          >
            <CategoryIcon shape={c.shape} active={active} />
            {c.label}
          </button>
        );
      })}
    </nav>
  );
}

export default CategoryNav;
