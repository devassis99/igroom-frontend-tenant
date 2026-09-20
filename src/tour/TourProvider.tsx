import { useEffect, useMemo } from "react";
import { useLocation } from "react-router";
import { TourOverlay } from "./TourOverlay";
import { findTourForPath } from "./find-tour";
import { hasSeenTour, useTourStore } from "./tour-store";
import { TOURS_BY_ID } from "./tours";
import type { Tour } from "./types";

/**
 * How long after a screen settles before a first-visit tour opens.
 *
 * Long enough for the page's own query to land and its content to lay
 * out — a spotlight on a skeleton is a spotlight on nothing — and short
 * enough that it still reads as part of arriving rather than as
 * something that interrupted you half a sentence in.
 */
const AUTOSTART_DELAY_MS = 900;

/**
 * Runs the right tour for the current screen.
 *
 * Mounted once per shell rather than once per page: the rules about
 * *when* a tour opens (first visit, not mid-tour, not while the tab is
 * in the background) are the same on all forty screens, and forty
 * copies of them is forty chances for one screen to behave differently
 * from the rest.
 */
export function TourProvider() {
  const { pathname } = useLocation();
  const tour = useMemo(() => findTourForPath(pathname), [pathname]);

  const activeTourId = useTourStore((state) => state.activeTourId);
  const stepIndex = useTourStore((state) => state.stepIndex);
  const seen = useTourStore((state) => state.seen);
  const autoplay = useTourStore((state) => state.autoplay);
  const start = useTourStore((state) => state.start);
  const next = useTourStore((state) => state.next);
  const back = useTourStore((state) => state.back);
  const dismiss = useTourStore((state) => state.dismiss);
  const abandon = useTourStore((state) => state.abandon);

  const active: Tour | undefined = activeTourId ? TOURS_BY_ID.get(activeTourId) : undefined;

  /**
   * A tour belongs to its screen. If the route changes while one is
   * running — a step let somebody through to a link, or the back button
   * went somewhere else — it closes *without* being marked as seen, so
   * it is still waiting the next time they land here properly.
   */
  useEffect(() => {
    if (activeTourId && activeTourId !== tour?.id) abandon();
  }, [pathname, activeTourId, tour?.id, abandon]);

  useEffect(() => {
    if (!tour || tour.manualOnly || !autoplay || activeTourId) return;
    if (hasSeenTour(seen, tour.id, tour.version)) return;
    // A tour that opens in a background tab is one that gets dismissed
    // blind when somebody comes back to it.
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;

    const timer = window.setTimeout(() => start(tour.id, "auto"), AUTOSTART_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [tour, autoplay, activeTourId, seen, start]);

  if (!active) return null;

  return (
    <TourOverlay
      tour={active}
      // Clamped rather than trusted: a tour whose steps were shortened
      // in a release still has a persisted index from before it.
      stepIndex={Math.min(stepIndex, active.steps.length - 1)}
      onNext={() => next(active.steps.length, active.version)}
      onBack={back}
      onDismiss={() => dismiss(active.version)}
    />
  );
}

/**
 * What a screen — or the header's help button — needs to open the tour
 * for wherever it is: which tour that would be, whether it is already
 * running, and how to start it.
 */
export function useTour() {
  const { pathname } = useLocation();
  const tour = useMemo(() => findTourForPath(pathname), [pathname]);
  const activeTourId = useTourStore((state) => state.activeTourId);
  const start = useTourStore((state) => state.start);

  return {
    tour,
    isActive: Boolean(tour && activeTourId === tour.id),
    /**
     * Works even with autoplay switched off and even when the tour has
     * been seen: asking for help is a request, not a preference.
     */
    startTour: () => {
      if (tour) start(tour.id, "manual");
    },
  };
}
