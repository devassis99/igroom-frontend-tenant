import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

/** A queue mid-afternoon: invented people, shown the way each view lays them out. */
const EXAMPLE_SERVING = {
  initials: "JR",
  color: "oklch(52% 0.11 250)",
  who: "Maya · Skin fade",
  meta: "With Jordan",
  time: "12 min left",
};

const EXAMPLE_WAITING = [
  {
    who: "Sam · Beard trim",
    name: "Sam",
    initials: "SK",
    meta: "Waiting 6 min · Any barber",
    eta: "~10 min",
  },
  {
    who: "Priya · Gel manicure",
    name: "Priya",
    initials: "PN",
    meta: "Waiting 3 min · Joined online",
    eta: "~25 min",
  },
  {
    who: "Leo · Kids cut",
    name: "Leo",
    initials: "LM",
    meta: "Waiting 1 min · Prefers Jordan",
    eta: "~35 min",
  },
] as const;

/** Circumference of the example's progress ring, for r=46 on a 100×100 viewBox. */
const RING_CIRCUMFERENCE = 2 * Math.PI * 46;

/**
 * The Live Waitlist with nobody in it: how the queue works and a way to
 * add the first walk-in, beside a picture of a busy one.
 *
 * Replaces the dashed "Nobody's waiting" boxes, which said the queue was
 * empty but not what fills it. The picture follows the List/Board switch,
 * so each view previews what it will look like once people join. It is
 * decoration — hidden from screen readers, not clickable — so nobody
 * mistakes it for real people.
 */
export function WaitlistEmptyState({
  view,
  onAdd,
  addDisabled,
}: {
  view: "list" | "board";
  onAdd: () => void;
  addDisabled: boolean;
}) {
  return (
    <section className="flex flex-col gap-8 rounded-2xl border border-tn-border bg-tn-surface p-8 lg:flex-row lg:items-center lg:gap-10">
      <div className="flex min-w-0 flex-1 flex-col gap-3 lg:max-w-[460px]">
        <h2 className="m-0 font-sans text-[24px] font-semibold text-tn-ink">
          Run your walk-in queue
        </h2>
        <p className="m-0 font-sans text-[14px] leading-relaxed text-tn-muted-5">
          Walk-ins join the line from your shop&rsquo;s page in the app, or you add them here at the
          desk. Everyone gets a place in line and an estimated wait. When a chair frees up, call the
          next person in — app customers get a message that it&rsquo;s their turn — then seat them,
          and the visit goes on the calendar.
        </p>
        <p className="m-0 font-sans text-[13px] text-tn-muted-5">
          {view === "board"
            ? "Board view shows each chair and how far through its appointment it is, with the line underneath."
            : "Booked clients you check in on the calendar show up here too."}
        </p>
        <Button className="mt-2 self-start" onClick={onAdd} disabled={addDisabled}>
          + Add a walk-in
        </Button>
      </div>

      <div
        aria-hidden
        className="pointer-events-none relative min-w-0 flex-1 select-none overflow-hidden rounded-2xl border border-tn-gold-bg bg-tn-page p-6"
      >
        {view === "board" ? <BoardExample /> : <ListExample />}
        {/* Fades the example out at the bottom, so it reads as a glimpse rather than something to scan. */}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-tn-page to-transparent" />
      </div>
    </section>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="m-0 mb-2 font-sans text-[12px] font-semibold tracking-[0.02em] text-tn-muted-5">
      {children}
    </p>
  );
}

/** The List view's rows: who's in a chair, then the line with the front of it highlighted. */
function ListExample() {
  return (
    <>
      <SectionLabel>NOW SERVING</SectionLabel>
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-tn-border-soft bg-tn-surface px-4 py-3">
        <Avatar initials={EXAMPLE_SERVING.initials} color={EXAMPLE_SERVING.color} />
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate font-sans text-[14px] font-semibold text-tn-ink">
            {EXAMPLE_SERVING.who}
          </p>
          <p className="m-0 truncate font-sans text-[12px] text-tn-muted-5">
            {EXAMPLE_SERVING.meta}
          </p>
        </div>
        <span className="shrink-0 font-sans text-[12px] font-semibold text-tn-gold">
          {EXAMPLE_SERVING.time}
        </span>
      </div>

      <SectionLabel>WAITING</SectionLabel>
      <div className="overflow-hidden rounded-xl border border-tn-border-soft bg-tn-surface">
        {EXAMPLE_WAITING.map((row, i) => (
          <div
            key={row.who}
            className={`flex items-center gap-3 px-4 py-3 ${
              i < EXAMPLE_WAITING.length - 1 ? "border-b border-tn-border-soft" : ""
            } ${i === 0 ? "bg-tn-detail-bg" : ""}`}
          >
            <span
              className={`w-7 shrink-0 font-sans text-[14px] font-semibold ${
                i === 0 ? "text-tn-gold" : "text-tn-muted-5"
              }`}
            >
              #{i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="m-0 truncate font-sans text-[14px] font-semibold text-tn-ink">
                {row.who}
              </p>
              <p className="m-0 truncate font-sans text-[12px] text-tn-muted-5">{row.meta}</p>
            </div>
            {/* Dropped when the two halves sit side by side on a narrower screen, so the names don't get cut off. */}
            <span className="hidden shrink-0 font-sans text-[12px] text-tn-muted-5 xl:inline">
              {row.eta}
            </span>
            {/* Only the front of the line gets the button, as on the real list. */}
            <span
              className={`shrink-0 rounded-lg px-3 py-1.5 font-sans text-[12px] font-semibold ${
                i === 0 ? "bg-tn-dark-gradient text-tn-on-dark" : "invisible"
              }`}
            >
              Call In
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

/** The Board view: a busy chair with its progress ring, a free one, and the line as faces. */
function BoardExample() {
  const progress = 0.7;
  return (
    <>
      <SectionLabel>CHAIRS — NOW SERVING</SectionLabel>
      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl border border-tn-border-soft bg-tn-surface px-3 py-4">
          <span className="relative mb-1 flex h-16 w-16 items-center justify-center">
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke="var(--color-tn-border-soft)"
                strokeWidth="7"
              />
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke="var(--color-tn-gold)"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={`${progress * RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
              />
            </svg>
            <Avatar initials={EXAMPLE_SERVING.initials} color={EXAMPLE_SERVING.color} size={48} />
          </span>
          <p className="m-0 font-sans text-[14px] font-semibold text-tn-ink">Jordan</p>
          <p className="m-0 truncate font-sans text-[12px] text-tn-muted-5">with Maya</p>
          <p className="m-0 font-sans text-[12px] font-semibold text-tn-gold">
            {EXAMPLE_SERVING.time}
          </p>
        </div>
        {/* White card, cream circle — the same as a free chair on the real board. */}
        <div className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl border border-dashed border-tn-border bg-tn-surface px-3 py-4">
          <span className="mb-1 flex h-16 w-16 items-center justify-center rounded-full bg-tn-page">
            <span className="h-3 w-3 rounded-full border-2 border-tn-faint-2" />
          </span>
          <p className="m-0 font-sans text-[14px] font-semibold text-tn-muted-5">Alex</p>
          <p className="m-0 truncate font-sans text-[12px] text-tn-muted-6">Open — ready</p>
          {/* Same height as the busy chair's time line, so the two cards line up. */}
          <p className="invisible m-0 font-sans text-[12px]">–</p>
        </div>
      </div>

      <SectionLabel>UP NEXT</SectionLabel>
      <div className="flex gap-5 rounded-xl border border-tn-border-soft bg-tn-surface px-4 py-4">
        {EXAMPLE_WAITING.map((row, i) => (
          <div
            key={row.who}
            className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center"
          >
            <span className="relative mb-1">
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-full font-sans text-[14px] font-semibold ${
                  i === 0
                    ? "border-2 border-tn-gold bg-tn-gold-bg-soft text-tn-gold"
                    : "bg-tn-neutral-bg text-tn-muted-3"
                }`}
              >
                {row.initials}
              </span>
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-tn-dark font-sans text-[11px] font-semibold text-tn-on-dark">
                {i + 1}
              </span>
            </span>
            <span className="max-w-full truncate font-sans text-[13px] font-semibold text-tn-ink">
              {row.name}
            </span>
            <span className="font-sans text-[12px] font-semibold text-tn-gold">{row.eta}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export default WaitlistEmptyState;
