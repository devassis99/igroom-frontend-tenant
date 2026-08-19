import { Button } from "@/components/ui/Button";

function BookIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

interface ResourceCard {
  title: string;
  description: string;
  ctaLabel: string;
}

const RESOURCE_CARDS: ResourceCard[] = [
  {
    title: "Help Docs",
    description: "Browse our documentation to find answers, guides, and best practices.",
    ctaLabel: "Browse Docs",
  },
  {
    title: "Contact Support",
    description: "Need help? Our support team is ready to assist you with any questions or issues.",
    ctaLabel: "Get Support",
  },
];

/**
 * Home page's "Resources & Support" section — modeled on the reference
 * account app's card row, minus its "iClosed University" card (no course/
 * certification program exists for iGroom yet, so only Help Docs +
 * Contact Support ship).
 *
 * Both CTAs are disabled placeholders for now — same "disabled +
 * explanatory title" convention as CustomerJourneyModal's not-wired-up
 * Book Appointment button — since there's no real docs site or support
 * inbox to link to yet. Swap `disabled`/`title` for a real
 * `<a target="_blank" rel="noreferrer" href=...>` once those exist.
 */
export function ResourcesSupportSection() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="m-0 font-serif text-xl font-semibold text-tn-ink">Resources &amp; Support</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {RESOURCE_CARDS.map((card) => (
          <div
            key={card.title}
            className="flex flex-col gap-3 rounded-xl border border-tn-border bg-tn-surface p-5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-tn-border text-tn-muted-5">
              <BookIcon />
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="m-0 font-sans text-[15px] font-semibold text-tn-ink">{card.title}</p>
              <p className="m-0 font-sans text-[13px] leading-relaxed text-tn-muted-5">
                {card.description}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled
              title="Coming soon"
              className="mt-1 flex w-fit items-center gap-1.5"
            >
              {card.ctaLabel}
              <ExternalLinkIcon />
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

export default ResourcesSupportSection;
