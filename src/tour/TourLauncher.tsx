/* oxlint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
/*
 * The rule fires on the click-catcher behind the open panel, which is
 * decoration with a convenience click on it — `aria-hidden`, never in
 * the tab order. Its keyboard equivalent is Escape, wired up below.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useAuthStore } from "@/auth/auth-store";
import { findTourForPath } from "./find-tour";
import { useTourStore } from "./tour-store";
import { TOURS } from "./tours";

/**
 * The help button in the bottom-right corner, and the panel it opens.
 *
 * Every screen's walkthrough is also a written guide — the same
 * sentences, read rather than pointed at — so this is a help centre the
 * product already has the content for. Nothing here talks to a server:
 * the search index is `tours.ts`, compiled into the bundle.
 *
 * It answers the three things somebody opens a help widget for:
 *
 *  - *What is this screen?* — one tap replays the walkthrough.
 *  - *What does this control do?* — the screen's own steps, listed, each
 *    one jumping the walkthrough straight to it.
 *  - *How do I do X?* — search across every screen, and a result on
 *    another screen takes you there and starts its walkthrough at the
 *    right step rather than leaving you to find it.
 */

interface SearchHit {
  tourId: string;
  tourTitle: string;
  path: string;
  stepIndex: number;
  title: string;
  body: string;
}

/**
 * Flattened once, at module load: every step of every tour, with the
 * route it lives on. Around 70 rows — small enough that a substring
 * scan per keystroke is cheaper than anything cleverer.
 */
const INDEX: readonly SearchHit[] = TOURS.flatMap((tour) =>
  tour.steps.map((step, stepIndex) => ({
    tourId: tour.id,
    tourTitle: tour.title,
    // Every tenant route is a static path, so the first pattern is a
    // link. (The customer app's `/:slug` tours would need more than
    // this — it has no launcher, which is why this stays simple.)
    path: tour.match[0] ?? "/dashboard",
    stepIndex,
    title: step.title,
    body: step.tip ? `${step.body} ${step.tip}` : step.body,
  })),
);

function search(query: string): SearchHit[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];
  const scored = INDEX.map((hit) => {
    // A title match is what somebody meant; a body match is usually the
    // right screen and the wrong step, so it ranks below.
    const title = hit.title.toLowerCase();
    const tourTitle = hit.tourTitle.toLowerCase();
    if (title.includes(needle)) return { hit, rank: 0 };
    if (tourTitle.includes(needle)) return { hit, rank: 1 };
    if (hit.body.toLowerCase().includes(needle)) return { hit, rank: 2 };
    return null;
  }).filter((row): row is { hit: SearchHit; rank: number } => row !== null);

  return scored
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 12)
    .map((row) => row.hit);
}

function ChevronRight() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="flex-none"
    >
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

export function TourLauncher() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const owner = useAuthStore((state) => state.owner);

  const activeTourId = useTourStore((state) => state.activeTourId);
  const autoplay = useTourStore((state) => state.autoplay);
  const setAutoplay = useTourStore((state) => state.setAutoplay);
  const start = useTourStore((state) => state.start);
  const goTo = useTourStore((state) => state.goTo);
  const requestTour = useTourStore((state) => state.requestTour);

  /**
   * Stamped with the screen it was opened on, and read back through
   * that stamp: a navigation closes the panel and clears the search
   * without an effect that resets them. (An effect would be a second
   * render, and for one frame the panel would still be listing the
   * steps of the page you just left.)
   */
  const [panel, setPanel] = useState({ path: pathname, open: false, query: "" });
  const here = panel.path === pathname;
  const open = here && panel.open;
  const query = here ? panel.query : "";
  const setOpen = (next: boolean) => setPanel({ path: pathname, open: next, query: "" });
  const setQuery = (next: string) => setPanel({ path: pathname, open: true, query: next });

  const panelRef = useRef<HTMLDialogElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  const tour = useMemo(() => findTourForPath(pathname), [pathname]);
  const hits = useMemo(() => search(query), [query]);
  const others = useMemo(() => TOURS.filter((t) => t.id !== tour?.id), [tour?.id]);

  /*
   * While a tour is running the panel stays shut, but the button itself
   * stays on screen: the Home tour's last step points at it, and a
   * spotlight on an element that unmounted itself is a spotlight on
   * nothing. The overlay dims it along with the rest of the page.
   */
  const running = Boolean(activeTourId);
  const panelOpen = open && !running;

  useEffect(() => {
    if (!panelOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      // The setter itself rather than the `setOpen` helper above: that
      // one is a new function every render, and this effect should be
      // bound once per open panel, not re-bound on every keystroke in
      // the search box.
      setPanel({ path: pathname, open: false, query: "" });
      launcherRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [panelOpen, pathname]);

  const runHere = (stepIndex = 0) => {
    if (!tour) return;
    setOpen(false);
    start(tour.id, "manual");
    if (stepIndex > 0) goTo(stepIndex);
  };

  const runThere = (hit: SearchHit) => {
    setOpen(false);
    if (hit.path === pathname) {
      runHere(hit.stepIndex);
      return;
    }
    // Asked for before the navigation and picked up by TourProvider once
    // the new screen is mounted — starting it here would run a tour
    // against a page that is still the old one.
    requestTour(hit.tourId, hit.stepIndex);
    void navigate(hit.path);
  };

  const firstName = owner?.fullName?.split(" ")[0];

  return (
    <>
      {panelOpen ? (
        <div aria-hidden="true" onClick={() => setOpen(false)} className="fixed inset-0 z-40" />
      ) : null}

      {panelOpen ? (
        <dialog
          ref={panelRef}
          open
          aria-label="Help"
          /*
           * `left-auto` and `top-auto` undo the <dialog> user-agent rule
           * `inset-inline-start: 0`: with a width set, left:0 and
           * right:24px are over-constrained, the browser drops `right`,
           * and the panel parks itself against the left edge of the
           * window instead of the corner it was asked for.
           */
          className="tn-rise-in fixed top-auto right-6 bottom-[86px] left-auto z-50 m-0 flex max-h-[min(620px,calc(100dvh-120px))] w-[min(380px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-tn-border bg-tn-surface p-0 text-tn-ink shadow-[0_24px_70px_-20px_oklch(22%_0.02_50_/_0.5)]"
        >
          <header className="flex flex-col gap-1 bg-tn-plan-bg px-5 pt-5 pb-14">
            <div className="flex items-start justify-between gap-3">
              <span className="font-serif text-[15px] font-semibold text-tn-on-dark">iGroom</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close help"
                className="-mt-1 -mr-1 cursor-pointer rounded-lg px-2 py-1 font-sans text-[15px] text-tn-on-dark/70 hover:bg-white/10 hover:text-tn-on-dark"
              >
                ✕
              </button>
            </div>
            <p className="m-0 mt-3 font-serif text-[21px] leading-snug font-semibold text-tn-on-dark">
              {firstName ? `Hi ${firstName} 👋` : "Hi there 👋"}
              <br />
              How can we help?
            </p>
          </header>

          {/*
           * The card that lifts over the header's bottom edge. Two things
           * keep it whole: it sits outside the scrolling body below, which
           * would clip a negative margin, and `relative z-10` paints it
           * over the header rather than under — being a later sibling is
           * usually enough, but a header that ever gains a stacking
           * context of its own would otherwise swallow its top third.
           *
           * It is first because the commonest question on any screen is
           * "what is this screen", and the walkthrough answers that better
           * than an article would.
           */}
          <div className="relative z-10 -mt-9 px-4">
            {tour ? (
              <button
                type="button"
                onClick={() => runHere(0)}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-tn-border bg-tn-surface px-4 py-3.5 text-left shadow-[0_10px_30px_-18px_oklch(22%_0.02_50_/_0.6)] transition-colors hover:border-tn-gold"
              >
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-tn-gold-bg font-sans text-[13px] font-semibold text-tn-gold">
                  ▸
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-sans text-[13.5px] font-semibold text-tn-ink">
                    Show me around this page
                  </span>
                  <span className="block font-sans text-[12px] text-tn-muted-5">
                    {tour.title} · {tour.steps.length} step
                    {tour.steps.length === 1 ? "" : "s"}
                  </span>
                </span>
                <ChevronRight />
              </button>
            ) : null}
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-4 pb-4">
            {/* The primary action, above the search box: the commonest
                question on any screen is "what is this screen", and the
                walkthrough answers it better than an article would. */}

            <label className="flex items-center gap-2 rounded-xl border border-tn-input-border bg-tn-page px-3.5 py-2.5">
              <span className="sr-only">Search for help</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search for help"
                className="w-full bg-transparent font-sans text-[13px] text-tn-ink outline-none placeholder:text-tn-placeholder"
              />
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
                className="flex-none text-tn-muted-6"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </label>

            {query.trim().length >= 2 ? (
              hits.length === 0 ? (
                <p className="m-0 px-1 py-6 text-center font-sans text-[13px] text-tn-muted-5">
                  Nothing matched “{query.trim()}”. Try the name of a screen — calendar, tips,
                  payouts.
                </p>
              ) : (
                <Group label={`${hits.length} result${hits.length === 1 ? "" : "s"}`}>
                  {hits.map((hit) => (
                    <Row
                      key={`${hit.tourId}:${hit.stepIndex}`}
                      title={hit.title}
                      hint={hit.tourTitle}
                      onClick={() => runThere(hit)}
                    />
                  ))}
                </Group>
              )
            ) : (
              <>
                {tour ? (
                  <Group label="On this page">
                    {tour.steps.map((step, index) => (
                      <Row
                        key={step.title}
                        title={step.title}
                        hint={step.body}
                        onClick={() => runHere(index)}
                      />
                    ))}
                  </Group>
                ) : null}

                <Group label="Other screens">
                  {others.map((other) => (
                    <Row
                      key={other.id}
                      title={other.title}
                      hint={`${other.steps.length} step${other.steps.length === 1 ? "" : "s"}`}
                      onClick={() =>
                        runThere({
                          tourId: other.id,
                          tourTitle: other.title,
                          path: other.match[0] ?? "/dashboard",
                          stepIndex: 0,
                          title: other.title,
                          body: "",
                        })
                      }
                    />
                  ))}
                </Group>
              </>
            )}
          </div>

          <footer className="flex flex-none items-center justify-between gap-3 border-t border-tn-border-soft px-4 py-3">
            <span className="font-sans text-[12px] text-tn-muted-5">
              {autoplay ? "Tips open on a screen's first visit" : "Tips only open from here"}
            </span>
            <button
              type="button"
              onClick={() => setAutoplay(!autoplay)}
              className="cursor-pointer rounded-lg border border-tn-input-border px-2.5 py-1.5 font-sans text-[12px] font-semibold text-tn-ink-soft transition-colors hover:bg-tn-page"
            >
              {autoplay ? "Turn off" : "Turn on"}
            </button>
          </footer>
        </dialog>
      ) : null}

      <button
        ref={launcherRef}
        type="button"
        data-tour="nav-help"
        onClick={() => setOpen(!panelOpen)}
        aria-expanded={panelOpen}
        aria-label={panelOpen ? "Close help" : "Help"}
        title="Help"
        className="fixed right-6 bottom-6 z-50 flex h-[52px] w-[52px] cursor-pointer items-center justify-center rounded-full border-none bg-tn-plan-bg text-tn-on-dark shadow-[0_16px_34px_-12px_oklch(22%_0.02_50_/_0.6)] transition-transform duration-200 hover:scale-[1.04] active:scale-[0.97]"
      >
        <span aria-hidden className="font-sans text-[20px] leading-none">
          {panelOpen ? "⌄" : "?"}
        </span>
      </button>
    </>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <p className="m-0 px-1 font-sans text-[11px] font-semibold tracking-[0.06em] text-tn-faint uppercase">
        {label}
      </p>
      <div className="flex flex-col overflow-hidden rounded-xl border border-tn-border-soft">
        {children}
      </div>
    </section>
  );
}

function Row({ title, hint, onClick }: { title: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex cursor-pointer items-center gap-3 border-b border-tn-border-soft px-3.5 py-3 text-left last:border-b-0 hover:bg-tn-page"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-sans text-[13px] font-medium text-tn-ink-soft">
          {title}
        </span>
        {hint ? (
          <span className="mt-0.5 block truncate font-sans text-[11.5px] text-tn-muted-6">
            {hint}
          </span>
        ) : null}
      </span>
      <span className="text-tn-muted-6">
        <ChevronRight />
      </span>
    </button>
  );
}
