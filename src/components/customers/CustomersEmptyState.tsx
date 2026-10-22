import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";

/**
 * A client list a few months in — invented people, one of each tag, so the
 * example shows what each one means. `daysAgo` rather than a date, so the
 * Inactive row is still 90+ days back whenever this is looked at. Avatar
 * colours are the darker ones only: white initials vanish on the pale
 * peach/tan/cream in the palette the real rows draw from.
 */
const EXAMPLE_ROWS = [
  {
    name: "Maya Lopez",
    initials: "ML",
    contact: "(555) 014-2290",
    color: "oklch(50% 0.1 20)",
    daysAgo: 0,
    spend: "$620",
    tag: { label: "VIP", tone: "gold" },
  },
  {
    name: "Sam Kerr",
    initials: "SK",
    contact: "sam.kerr@example.com",
    color: "var(--color-tn-avatar-blue)",
    daysAgo: 9,
    spend: "$210",
    tag: null,
  },
  {
    name: "Priya Nair",
    initials: "PN",
    contact: "(555) 018-7731",
    color: "oklch(52% 0.09 150)",
    daysAgo: 2,
    spend: "$40",
    tag: { label: "New", tone: "success" },
  },
  {
    name: "Leo Martin",
    initials: "LM",
    contact: "(555) 012-4408",
    color: "var(--color-tn-avatar-brown)",
    daysAgo: 124,
    spend: "$105",
    tag: { label: "Inactive", tone: "neutral" },
  },
] as const;

/**
 * Four of the real table's six columns — the ones that explain the tags.
 * Narrow enough to fit whole beside the text from xl up, so nothing is cut
 * off: the tags are the point of the example and sit at the far end.
 */
const GRID =
  "grid grid-cols-[minmax(150px,1.8fr)_minmax(64px,0.8fr)_minmax(52px,0.6fr)_76px] gap-3";

/** The same "Today" / "Oct 3" the real table's Last visit column shows. */
function lastVisitLabel(daysAgo: number): string {
  if (daysAgo === 0) return "Today";
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

/**
 * The Customers page before the shop has any customers: where they come
 * from and what the list does with them, beside a picture of a filled one.
 *
 * Replaces the one-line "No customers yet" under four zeroed tiles. The
 * thing a new owner most needs to know is that they don't have to type
 * their client book in — booking someone is what adds them — and the
 * example shows what the tags mean before any have appeared. Side by
 * side from xl, stacked below it — at lg the two halves are too narrow for
 * the example to reach its tag column. The example
 * is decoration — hidden from screen readers, not clickable — so nobody
 * mistakes it for real people.
 */
export function CustomersEmptyState({
  canManage,
  onAdd,
}: {
  canManage: boolean;
  onAdd: () => void;
}) {
  return (
    <section className="flex flex-col gap-8 rounded-2xl border border-tn-border bg-tn-surface p-8 xl:flex-row xl:items-center xl:gap-10">
      <div className="flex min-w-0 flex-1 flex-col gap-3 max-w-[640px] xl:max-w-[400px]">
        <h2 className="m-0 font-sans text-[24px] font-semibold text-tn-ink">Know your regulars</h2>
        <p className="m-0 font-sans text-[14px] leading-relaxed text-tn-muted-5">
          Everyone you book lands here on their own — from the calendar, your booking link, the app
          or the waitlist. They&rsquo;re matched by phone or email, so a regular stays one person
          however they book, with their visits, what they&rsquo;ve spent and who they usually see.
        </p>
        <p className="m-0 font-sans text-[13px] leading-relaxed text-tn-muted-5">
          Tags sort them for you: VIP for the clients you flag, New for anyone added this month, and
          Inactive once someone hasn&rsquo;t been in for 90 days — the ones worth a message.
        </p>
        {canManage ? (
          <Button className="mt-2 self-start" onClick={onAdd}>
            + Add a customer
          </Button>
        ) : (
          <p className="m-0 mt-2 font-sans text-[13px] text-tn-muted-5">
            An owner or manager can add someone directly.
          </p>
        )}
      </div>

      <div
        aria-hidden
        className="pointer-events-none relative min-w-0 flex-1 select-none overflow-hidden rounded-2xl border border-tn-gold-bg bg-tn-page p-6"
      >
        <div className="overflow-hidden rounded-xl border border-tn-border-soft bg-tn-surface">
          <div
            className={`${GRID} border-b border-tn-border-soft bg-tn-table-head px-4 py-3 font-sans text-[12px] font-semibold text-tn-muted-5`}
          >
            <span>CUSTOMER</span>
            <span>LAST VISIT</span>
            <span>SPEND</span>
            <span>TAG</span>
          </div>
          {EXAMPLE_ROWS.map((row, i) => (
            <div
              key={row.name}
              className={`${GRID} items-center px-4 py-3 font-sans text-[14px] ${
                i < EXAMPLE_ROWS.length - 1 ? "border-b border-tn-border-soft" : ""
              }`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <Avatar initials={row.initials} color={row.color} size={28} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-tn-ink">{row.name}</span>
                  <span className="block truncate text-[12px] text-tn-muted-5">{row.contact}</span>
                </span>
              </span>
              <span className="text-tn-muted-2">{lastVisitLabel(row.daysAgo)}</span>
              <span className="text-tn-muted-2">{row.spend}</span>
              <span>{row.tag && <StatusPill tone={row.tag.tone}>{row.tag.label}</StatusPill>}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default CustomersEmptyState;
