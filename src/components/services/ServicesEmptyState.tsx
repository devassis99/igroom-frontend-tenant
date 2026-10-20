import { Button } from "@/components/ui/Button";

/** What a filled-in menu looks like — invented rows, one per kind of shop, so every owner sees their own trade in it. */
const EXAMPLE_ROWS = [
  { name: "Skin fade", duration: "30 min", price: "$35", where: "All locations" },
  { name: "Cut & blow-dry", duration: "1 hr", price: "$65", where: "All locations" },
  { name: "Gel manicure", duration: "45 min", price: "$40", where: "Downtown" },
  { name: "Deep-tissue massage", duration: "1 hr", price: "$90", where: "Downtown" },
] as const;

/**
 * The Services page before the shop has any services: what the page is
 * for and a way to start, beside a picture of where it ends up.
 *
 * Replaces a one-line "No services yet" inside an empty table. A new
 * owner arriving here has nothing to look at and no idea what a good
 * service entry contains; the example shows the shape (name, length,
 * price, where it's offered) before they've typed anything. The example
 * is decoration — hidden from screen readers, not clickable — so nobody
 * mistakes it for data.
 */
export function ServicesEmptyState({
  canManage,
  onAdd,
}: {
  canManage: boolean;
  onAdd: () => void;
}) {
  return (
    <section className="flex flex-col gap-8 rounded-2xl border border-tn-border bg-tn-surface p-8 lg:flex-row lg:items-center lg:gap-10">
      <div className="flex min-w-0 flex-1 flex-col gap-3 lg:max-w-[460px]">
        <h2 className="m-0 font-sans text-[24px] font-semibold text-tn-ink">
          Build your service menu
        </h2>
        <p className="m-0 font-sans text-[14px] leading-relaxed text-tn-muted-5">
          Add what you offer — cuts, colour, nails, treatments — with a price and how long it takes.
          Clients book from this menu on your booking link, your team sees it on the calendar, and
          each service can run at every location or just some.
        </p>
        {canManage ? (
          <Button className="mt-2 self-start" onClick={onAdd}>
            + Add your first service
          </Button>
        ) : (
          <p className="m-0 mt-2 font-sans text-[13px] text-tn-muted-5">
            An owner or manager can add services.
          </p>
        )}
      </div>

      <div
        aria-hidden
        className="pointer-events-none relative min-w-0 flex-1 select-none overflow-hidden rounded-2xl border border-tn-gold-bg bg-tn-page p-6"
      >
        <div className="overflow-hidden rounded-xl border border-tn-border-soft bg-tn-surface">
          <div className="grid grid-cols-[minmax(150px,1.6fr)_90px_70px_minmax(120px,1fr)] gap-3 border-b border-tn-border-soft bg-tn-table-head px-4 py-3 font-sans text-[12px] font-semibold text-tn-muted-5">
            <span>SERVICE</span>
            <span>DURATION</span>
            <span>PRICE</span>
            <span>LOCATIONS</span>
          </div>
          {EXAMPLE_ROWS.map((row, i) => (
            <div
              key={row.name}
              className={`grid grid-cols-[minmax(150px,1.6fr)_90px_70px_minmax(120px,1fr)] gap-3 px-4 py-3.5 font-sans text-[14px] ${
                i < EXAMPLE_ROWS.length - 1 ? "border-b border-tn-border-soft" : ""
              }`}
            >
              <span className="truncate font-semibold text-tn-ink">{row.name}</span>
              <span className="text-tn-muted-2">{row.duration}</span>
              <span className="text-tn-muted-2">{row.price}</span>
              <span className="truncate text-tn-muted-2">{row.where}</span>
            </div>
          ))}
        </div>
        {/* Fades the example out at the right edge, so it reads as a glimpse rather than a table to scan. */}
        <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-tn-page to-transparent" />
      </div>
    </section>
  );
}

export default ServicesEmptyState;
