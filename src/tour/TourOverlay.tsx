/* oxlint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
/*
 * Both rules fire on the backdrop panels below, and both are asking for
 * something that already exists elsewhere. The panels are decoration
 * with a convenience click on them — `aria-hidden`, never in the tab
 * order — and the keyboard equivalents they want are Escape and the
 * card's own Skip button, which are wired up a few lines down. A key
 * handler on a hidden div would be dead code that looks like a fix.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cardWidth, placeCard, useTourAnchor, type Size } from "./tour-anchor";
import type { Tour } from "./types";

/**
 * The tour itself, on screen: a dimmed page with one element lit up,
 * and a card beside it.
 *
 * Built from four backdrop panels around a hole rather than one
 * full-screen overlay with an SVG mask. The hole is then genuinely
 * empty — nothing stacked over it, nothing to punch through — so a step
 * can let somebody use the control it is pointing at simply by not
 * covering it (`interactive`), and the default case covers it with a
 * transparent blocker. A mask would have turned every click into a
 * `pointer-events` puzzle for the same result.
 */

interface TourOverlayProps {
  tour: Tour;
  stepIndex: number;
  onNext: () => void;
  onBack: () => void;
  /** Skip, Escape, or a click on the dimmed area — all end the tour for good. */
  onDismiss: () => void;
}

function useViewport(): Size {
  const [size, setSize] = useState<Size>(() => ({
    width: typeof window === "undefined" ? 1280 : window.innerWidth,
    height: typeof window === "undefined" ? 800 : window.innerHeight,
  }));

  useEffect(() => {
    const measure = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    // A phone's address bar collapsing changes the usable height without
    // a window resize in some browsers; the visual viewport reports it.
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, []);

  return size;
}

export function TourOverlay({ tour, stepIndex, onNext, onBack, onDismiss }: TourOverlayProps) {
  const step = tour.steps[stepIndex];
  const total = tour.steps.length;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === total - 1;

  const viewport = useViewport();
  const { rect, ready } = useTourAnchor(step?.anchor, `${tour.id}:${stepIndex}`);

  const cardRef = useRef<HTMLDialogElement>(null);
  const [cardHeight, setCardHeight] = useState(210);
  const titleId = useId();
  const bodyId = useId();

  const width = cardWidth(viewport.width);

  /**
   * The card is measured, not guessed. Its height depends on how long
   * the copy is and whether the step carries a tip, and placing a
   * 210px-tall card that turns out to be 300px is what puts the buttons
   * behind the tab bar on a phone.
   */
  useLayoutEffect(() => {
    const element = cardRef.current;
    if (!element) return;
    const measure = () => {
      const height = element.getBoundingClientRect().height;
      setCardHeight((current) => (Math.abs(current - height) < 1 ? current : height));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [stepIndex, tour.id, width]);

  // Focus moves to the card on every step: a keyboard user shouldn't
  // have to hunt for Next, and a screen reader should read the step
  // rather than whatever happened to be focused on the page behind it.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cardRef.current?.focus({ preventScroll: true });
    return () => {
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [stepIndex, tour.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onDismiss();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onNext();
        return;
      }
      if (event.key === "ArrowLeft" && stepIndex > 0) {
        event.preventDefault();
        onBack();
        return;
      }
      if (event.key === "Tab") {
        // A small trap rather than a library: the page behind the card
        // is dimmed and inert to the mouse, and tabbing into something
        // you cannot see is worse than a loop of three buttons.
        const focusable = cardRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled)");
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        const active = document.activeElement;
        if (event.shiftKey && (active === first || active === cardRef.current)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onNext, onBack, onDismiss, stepIndex]);

  if (!step) return null;
  // Dimming the page around an element that hasn't been found yet gives
  // a flash of "everything is highlighted" before the hole appears.
  if (!ready) return null;

  const padding = step.padding ?? 10;
  const radius = step.radius ?? 16;
  const hole = rect
    ? {
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      }
    : null;

  const position = placeCard({
    spotlight: hole,
    card: { width, height: cardHeight },
    viewport,
    preferred: step.placement ?? "auto",
  });

  /*
   * 220ms on the panels and the ring is what makes moving between steps
   * read as one spotlight sliding rather than four rectangles being
   * redrawn. The reduced-motion block in index.css flattens it for
   * anyone who asked for that.
   */
  const panel =
    "fixed z-[60] bg-tn-backdrop transition-[top,left,width,height] duration-[220ms] ease-out";

  const overlay = (
    <>
      {hole ? (
        <>
          <div
            aria-hidden="true"
            onClick={onDismiss}
            className={`${panel} tn-tour-fade top-0 left-0 w-full`}
            style={{ height: Math.max(hole.top, 0) }}
          />
          <div
            aria-hidden="true"
            onClick={onDismiss}
            className={`${panel} tn-tour-fade left-0 w-full`}
            style={{
              top: hole.top + hole.height,
              height: Math.max(viewport.height - hole.top - hole.height, 0),
            }}
          />
          <div
            aria-hidden="true"
            onClick={onDismiss}
            className={`${panel} tn-tour-fade left-0`}
            style={{ top: hole.top, height: hole.height, width: Math.max(hole.left, 0) }}
          />
          <div
            aria-hidden="true"
            onClick={onDismiss}
            className={`${panel} tn-tour-fade`}
            style={{
              top: hole.top,
              left: hole.left + hole.width,
              height: hole.height,
              width: Math.max(viewport.width - hole.left - hole.width, 0),
            }}
          />

          {/* The lit edge. Never interactive — it sits over the element. */}
          <div
            aria-hidden="true"
            className="pointer-events-none fixed z-[61] ring-2 ring-tn-gold-soft transition-[top,left,width,height] duration-[220ms] ease-out"
            style={{
              top: hole.top,
              left: hole.left,
              width: hole.width,
              height: hole.height,
              borderRadius: radius,
              boxShadow: "0 0 0 6px oklch(78% 0.09 85 / 0.18)",
            }}
          />

          {step.interactive ? null : (
            /*
             * Transparent, over the hole, and clickable: without it the
             * highlighted control is the one thing on a dimmed page that
             * still works, which invites a press that leaves the tour
             * pointing at a screen that has gone. Tapping it moves on
             * instead, which is what the gesture means here.
             */
            <div
              aria-hidden="true"
              onClick={onNext}
              className="fixed z-[62] cursor-pointer transition-[top,left,width,height] duration-[220ms] ease-out"
              style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }}
            />
          )}
        </>
      ) : (
        <div
          aria-hidden="true"
          onClick={onDismiss}
          className="tn-tour-fade fixed inset-0 z-[60] bg-tn-backdrop"
        />
      )}

      {/*
       * A real <dialog>, open and non-modal, rather than a div wearing
       * role="dialog": it is announced as a dialog without being told
       * to be one, and `open` keeps it in the normal flow where a fixed
       * position and a z-index still mean something. `showModal()` is
       * deliberately not used — the top layer would put this above the
       * spotlight it is explaining, and the page underneath has to stay
       * visible for any of it to make sense.
       */}
      <dialog
        ref={cardRef}
        open
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        className="tn-rise-in fixed z-[70] m-0 rounded-2xl border border-tn-border-soft bg-tn-surface p-5 text-tn-ink shadow-[0_20px_60px_-15px_oklch(22%_0.02_50_/_0.45)] outline-none"
        style={{ top: position.top, left: position.left, width }}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="font-serif text-[17px] font-semibold text-tn-ink">
            {step.title}
          </h2>
          <span className="mt-0.5 flex-none font-sans text-[12px] font-medium text-tn-muted-5 tabular-nums">
            {stepIndex + 1}/{total}
          </span>
        </div>

        <p id={bodyId} className="mt-2 font-sans text-[14px] leading-relaxed text-tn-muted-3">
          {step.body}
        </p>

        {step.tip ? (
          <p className="mt-3.5 rounded-xl bg-tn-gold-bg-soft px-3.5 py-3 font-sans text-[13px] leading-relaxed text-tn-ink-soft">
            <span className="font-semibold text-tn-gold">Pro tip: </span>
            {step.tip}
          </p>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onDismiss}
            className="-ml-1.5 rounded-lg px-1.5 py-2 font-sans text-[13.5px] font-medium text-tn-muted-5 transition-colors hover:text-tn-ink"
          >
            Skip
          </button>

          <div className="flex items-center gap-2">
            {isFirst ? null : (
              <button
                type="button"
                onClick={onBack}
                className="rounded-[10px] border border-tn-input-border bg-tn-surface px-3.5 py-2 font-sans text-[13.5px] font-semibold text-tn-ink transition-colors hover:bg-tn-page"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={onNext}
              className="rounded-[10px] bg-tn-dark px-4 py-2 font-sans text-[13.5px] font-semibold text-tn-on-dark transition-colors hover:opacity-90"
            >
              {isLast ? "Finish" : "Next"}
            </button>
          </div>
        </div>

        {/* How much is left, under the buttons rather than above them:
            the counter already says it in words, and a bar at the top of
            the card competes with the title for the first glance. */}
        <div className="mt-3.5 h-[3px] w-full overflow-hidden rounded-full bg-tn-border-softer">
          <div
            className="h-full rounded-full bg-tn-gold transition-[width] duration-[220ms] ease-out"
            style={{ width: `${((stepIndex + 1) / total) * 100}%` }}
          />
        </div>
      </dialog>
    </>
  );

  // Portaled to the body: the overlay is `position: fixed` and would
  // otherwise be trapped by any ancestor with a transform — which the
  // shop grid's hover-lifted cards and the public flow's animated steps
  // both have.
  return createPortal(overlay, document.body);
}
