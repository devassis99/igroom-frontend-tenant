import { useEffect, useState } from "react";

/**
 * Finding the element a step points at, and deciding where its card
 * goes.
 *
 * Kept apart from the overlay because it is the only genuinely fiddly
 * part of a tour — an element that hasn't mounted yet, a page that has
 * to scroll before the element is visible, a card that would hang off
 * the edge of a phone — and because `placeCard` is a pure function of
 * four rectangles, which makes it the one piece here worth unit tests.
 */

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export type ResolvedPlacement = "top" | "bottom" | "left" | "right" | "centre";

/** Gap between the spotlight and the card. */
const GAP = 14;
/** How close either may get to the edge of the viewport. */
const MARGIN = 14;
/**
 * Room kept clear at the bottom of a narrow window. Zero here: this app
 * has no fixed bottom bar for a card to hide behind — it is a desktop
 * admin screen with a sidebar, and the only fixed thing in it is the
 * calendar's scroll-right affordance, which a card may safely cover.
 */
const BOTTOM_BAR_INSET = 0;
/** Below this width the card spans the screen instead of hanging off a side. */
const NARROW = 640;
/**
 * How long to keep looking for an element before giving up and showing
 * the step as a centred card. Long enough for a query to resolve and
 * the section to render, short enough that nobody waits at a dimmed
 * screen wondering what broke.
 */
const ANCHOR_TIMEOUT_MS = 2500;

export interface AnchorState {
  /** Null while searching, and for a step that has no anchor at all. */
  rect: Rect | null;
  /**
   * False only while an anchor is still being looked for. The overlay
   * waits on this rather than dimming the page around nothing.
   */
  ready: boolean;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/** Already comfortably on screen? Then don't scroll — it only looks like a glitch. */
function isComfortablyVisible(rect: DOMRect): boolean {
  return rect.top >= MARGIN && rect.bottom <= window.innerHeight - MARGIN;
}

/**
 * The visible element carrying an anchor, of however many do.
 *
 * Several anchors are deliberately on more than one element — the
 * register's ticket panel has three states with three roots, the
 * calendar draws a different grid per view — because they are the same
 * thing in different conditions, and one step should cover all of them.
 * Only one is ever laid out, so "the first one with a size" is the right
 * element, and `querySelector` alone would find a hidden one half the
 * time.
 */
function findVisibleAnchor(anchor: string): HTMLElement | null {
  const matches = document.querySelectorAll<HTMLElement>(`[data-tour="${anchor}"]`);
  for (const element of matches) {
    const box = element.getBoundingClientRect();
    if (box.width > 0 && box.height > 0) return element;
  }
  return null;
}

/**
 * Tracks `[data-tour="..."]` for the current step: waits for it to
 * appear, scrolls it into view, and keeps its rectangle current while
 * the page scrolls, resizes or reflows underneath.
 *
 * `stepKey` changes on every step (and every tour), which is what makes
 * the whole effect re-run rather than trying to diff its way from one
 * element to the next.
 */
export function useTourAnchor(anchor: string | undefined, stepKey: string): AnchorState {
  /**
   * Stamped with the step it belongs to, and read back through that
   * stamp below, so moving to the next step doesn't need an effect that
   * clears the last one's rectangle: a state reset in an effect renders
   * twice, and the first of those two renders would dim the page around
   * the *previous* step's element for a frame.
   */
  const [tracked, setTracked] = useState<AnchorState & { key: string }>(() => ({
    key: stepKey,
    rect: null,
    ready: !anchor,
  }));

  useEffect(() => {
    // Nothing to find: the derived value below is already `ready`.
    if (!anchor) return;

    let cancelled = false;
    let frame = 0;
    const report = (next: AnchorState) => {
      if (!cancelled) setTracked({ key: stepKey, ...next });
    };
    let stop: (() => void) | undefined;
    const deadline = Date.now() + ANCHOR_TIMEOUT_MS;

    const track = (element: HTMLElement) => {
      const measure = () => {
        const box = element.getBoundingClientRect();
        report({
          rect: { top: box.top, left: box.left, width: box.width, height: box.height },
          ready: true,
        });
      };

      measure();
      if (!isComfortablyVisible(element.getBoundingClientRect())) {
        element.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: prefersReducedMotion() ? "auto" : "smooth",
        });
      }

      // Capture phase, for the same reason useAnchoredPanel uses it: a
      // scroll inside an overflow container never reaches window, and
      // this app has several (the category rail, the offer rail).
      window.addEventListener("scroll", measure, true);
      window.addEventListener("resize", measure);
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      // A smooth scroll settles over ~400ms without firing anything
      // useful at the end of it in every browser, so take one more
      // reading once it has had time to finish.
      const settle = window.setTimeout(measure, 450);

      stop = () => {
        window.removeEventListener("scroll", measure, true);
        window.removeEventListener("resize", measure);
        observer.disconnect();
        window.clearTimeout(settle);
      };
    };

    const look = () => {
      if (cancelled) return;
      // A zero-size match is a section that has mounted but not laid out
      // yet, or the copy of an anchor that is hidden at this breakpoint.
      // Both are worth waiting a few frames for.
      const element = findVisibleAnchor(anchor);
      if (element) {
        track(element);
        return;
      }
      if (Date.now() > deadline) {
        // Nothing found. The step still has something to say, so it
        // becomes a centred card rather than disappearing.
        report({ rect: null, ready: true });
        return;
      }
      frame = requestAnimationFrame(look);
    };

    // Next frame rather than right now: the step that just became
    // current may have mounted something this render, and a frame of
    // patience is cheaper than a lookup that misses it.
    frame = requestAnimationFrame(look);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stop?.();
    };
  }, [anchor, stepKey]);

  // A step whose effect hasn't reported back yet is still searching —
  // which is also exactly what a stamp from the previous step means.
  if (tracked.key !== stepKey) return { rect: null, ready: !anchor };
  return { rect: tracked.rect, ready: tracked.ready };
}

function clamp(value: number, min: number, max: number): number {
  // `min` wins when the two cross, which they do on a viewport shorter
  // than the card: that keeps the title and the buttons on screen
  // rather than centring the middle of the card in the window.
  return Math.max(min, Math.min(value, max));
}

export interface CardPosition {
  top: number;
  left: number;
  placement: ResolvedPlacement;
}

/**
 * Where the card sits, given the hole in the backdrop and how big the
 * card turned out to be.
 *
 * Pure, and deliberately so: every interesting case here is a rectangle
 * near an edge, and those are much easier to assert than to eyeball on
 * six screen sizes.
 */
export function placeCard({
  spotlight,
  card,
  viewport,
  preferred = "auto",
}: {
  spotlight: Rect | null;
  card: Size;
  viewport: Size;
  preferred?: ResolvedPlacement | "auto";
}): CardPosition {
  const narrow = viewport.width < NARROW;
  const bottomLimit = viewport.height - card.height - MARGIN - (narrow ? BOTTOM_BAR_INSET : 0);
  const rightLimit = viewport.width - card.width - MARGIN;

  if (!spotlight) {
    return {
      top: clamp((viewport.height - card.height) / 2, MARGIN, bottomLimit),
      left: clamp((viewport.width - card.width) / 2, MARGIN, rightLimit),
      placement: "centre",
    };
  }

  const room = {
    top: spotlight.top - GAP - MARGIN,
    bottom: viewport.height - (spotlight.top + spotlight.height) - GAP - MARGIN,
    left: spotlight.left - GAP - MARGIN,
    right: viewport.width - (spotlight.left + spotlight.width) - GAP - MARGIN,
  };

  const fits: Record<Exclude<ResolvedPlacement, "centre">, boolean> = {
    top: room.top >= card.height,
    bottom: room.bottom >= card.height,
    // On a phone the card is nearly the width of the screen, so a side
    // placement is never the answer even when the arithmetic allows it.
    left: !narrow && room.left >= card.width,
    right: !narrow && room.right >= card.width,
  };

  const order: Array<Exclude<ResolvedPlacement, "centre">> = ["bottom", "top", "right", "left"];
  const candidates =
    preferred !== "auto" && preferred !== "centre"
      ? [preferred, ...order.filter((side) => side !== preferred)]
      : order;

  // Nothing fits — a spotlight filling a short window, most of a phone
  // in landscape. Fall back to the side with the most room and let the
  // clamp do its work: a card overlapping its own spotlight still beats
  // one off-screen.
  const chosen =
    candidates.find((side) => fits[side]) ??
    order.reduce<Exclude<ResolvedPlacement, "centre">>(
      (best, side) => (room[side] > room[best] ? side : best),
      "bottom",
    );

  const centredX = clamp(spotlight.left + spotlight.width / 2 - card.width / 2, MARGIN, rightLimit);
  const centredY = clamp(
    spotlight.top + spotlight.height / 2 - card.height / 2,
    MARGIN,
    bottomLimit,
  );

  switch (chosen) {
    case "top":
      return {
        top: clamp(spotlight.top - card.height - GAP, MARGIN, bottomLimit),
        left: centredX,
        placement: "top",
      };
    case "left":
      return {
        top: centredY,
        left: clamp(spotlight.left - card.width - GAP, MARGIN, rightLimit),
        placement: "left",
      };
    case "right":
      return {
        top: centredY,
        left: clamp(spotlight.left + spotlight.width + GAP, MARGIN, rightLimit),
        placement: "right",
      };
    default:
      return {
        top: clamp(spotlight.top + spotlight.height + GAP, MARGIN, bottomLimit),
        left: centredX,
        placement: "bottom",
      };
  }
}

/** The card's width at a given viewport: a fixed column, or the screen on a phone. */
export function cardWidth(viewportWidth: number): number {
  if (viewportWidth < NARROW) return Math.min(viewportWidth - MARGIN * 2, 420);
  return 352;
}
