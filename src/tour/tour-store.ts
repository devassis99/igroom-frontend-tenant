import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * What the browser remembers about tours, and what is only true right
 * now.
 *
 * Only the first half is persisted (see `partialize`). Which tour is
 * open and which step it is on is runtime state by definition — a tour
 * restored from storage on the next page load would reopen over a
 * screen the customer navigated to themselves, which is the single most
 * annoying thing a product tour can do.
 */
interface TourState {
  /**
   * tourId -> the `version` of the tour that was finished or skipped.
   * A number rather than a boolean so bumping a tour's version brings
   * it back for people who have already seen the old one.
   */
  seen: Record<string, number>;
  /**
   * The master switch, off-able from Account. Somebody who has decided
   * they don't want tips should stop getting them on every new screen,
   * not have to dismiss forty of them one at a time. The help button
   * still works — turning this off stops tours starting on their own,
   * it doesn't take the documentation away.
   */
  autoplay: boolean;

  activeTourId: string | null;
  stepIndex: number;
  /** Auto-started on first visit, or opened from the help panel. */
  source: "auto" | "manual";
  /**
   * A tour asked for from a *different* screen — the help panel's
   * search can land on a step of the calendar's guide while you are
   * standing on Payouts. The navigation has to happen first, so the
   * request is parked here and TourProvider picks it up once the right
   * screen is mounted.
   */
  pending: { tourId: string; stepIndex: number } | null;

  start: (tourId: string, source?: "auto" | "manual") => void;
  /** Queue a tour that lives on another screen; navigate, and it runs on arrival. */
  requestTour: (tourId: string, stepIndex: number) => void;
  clearPending: () => void;
  next: (stepCount: number, tourVersion: number) => void;
  back: () => void;
  goTo: (index: number) => void;
  /** Ends the tour and remembers it — the Skip button, Escape, Finish. */
  dismiss: (tourVersion: number) => void;
  /** Ends the tour without remembering it, for a route change mid-tour. */
  abandon: () => void;
  setAutoplay: (autoplay: boolean) => void;
  /** "Show tips again" — every tour becomes unseen. */
  resetSeen: () => void;
}

export const useTourStore = create<TourState>()(
  persist(
    (set, get) => ({
      seen: {},
      autoplay: true,
      activeTourId: null,
      stepIndex: 0,
      source: "auto",
      pending: null,

      start: (tourId, source = "manual") =>
        set({ activeTourId: tourId, stepIndex: 0, source, pending: null }),

      requestTour: (tourId, stepIndex) => set({ pending: { tourId, stepIndex } }),

      clearPending: () => set({ pending: null }),

      next: (stepCount, tourVersion) => {
        const { stepIndex, activeTourId } = get();
        if (stepIndex + 1 >= stepCount) {
          // The last Next is a Finish, and finishing counts as seen.
          if (activeTourId) {
            set((state) => ({
              seen: { ...state.seen, [activeTourId]: tourVersion },
              activeTourId: null,
              stepIndex: 0,
            }));
          }
          return;
        }
        set({ stepIndex: stepIndex + 1 });
      },

      back: () => set((state) => ({ stepIndex: Math.max(0, state.stepIndex - 1) })),

      goTo: (index) => set({ stepIndex: Math.max(0, index) }),

      dismiss: (tourVersion) => {
        const { activeTourId } = get();
        set((state) => ({
          // Skipping is a decision, not an accident: it means "I don't
          // need this", so the tour doesn't come back on the next visit
          // either. The help button is how you get it back.
          seen: activeTourId ? { ...state.seen, [activeTourId]: tourVersion } : state.seen,
          activeTourId: null,
          stepIndex: 0,
        }));
      },

      abandon: () => set({ activeTourId: null, stepIndex: 0 }),

      setAutoplay: (autoplay) => set({ autoplay }),

      resetSeen: () => set({ seen: {}, autoplay: true }),
    }),
    {
      name: "igroom.tenant.tours.v1",
      partialize: (state) => ({ seen: state.seen, autoplay: state.autoplay }),
    },
  ),
);

/** True when this browser has already been shown the current cut of a tour. */
export function hasSeenTour(seen: Record<string, number>, id: string, version: number): boolean {
  return (seen[id] ?? -1) >= version;
}
