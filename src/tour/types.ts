/**
 * The shape of an in-app tour.
 *
 * A tour is a short, skippable walkthrough that runs the first time
 * somebody lands on a screen: a dimmed page, one element lit up at a
 * time, and a card explaining what that element is for. It is the
 * closest thing this app has to documentation, and it is deliberately
 * written as content rather than code — every tour in the app lives in
 * `tours.ts` as plain data, so changing what a customer is told is a
 * copy edit, not a component change.
 */

/** Which side of the highlighted element the card prefers to sit on. */
export type TourPlacement = "auto" | "top" | "bottom" | "left" | "right";

export interface TourStep {
  /**
   * The element this step points at, matched as `[data-tour="..."]`.
   *
   * Omitted for a step that belongs to the whole screen rather than one
   * control — the first step of most tours, which introduces the page.
   * Those render as a centred card over a dimmed page, which is also
   * what an anchored step falls back to when its element isn't on
   * screen (a section that only exists once you have a booking, say).
   */
  anchor?: string;
  title: string;
  /** One or two sentences. Longer than that and nobody reads it. */
  body: string;
  /**
   * The optional second paragraph, rendered in its own tinted block —
   * the "did you know" half of the step. Use it for the thing a
   * customer would otherwise only find by accident, never to continue a
   * sentence from `body`.
   */
  tip?: string;
  placement?: TourPlacement;
  /**
   * How much breathing room to leave around the element inside the
   * spotlight. The default suits a card or a button; a full-width
   * section usually wants less, a tight icon button more.
   */
  padding?: number;
  /**
   * Corner radius of the spotlight cut-out. Defaults to 16, which fits
   * this app's `rounded-2xl` cards; pass 999 for anything circular
   * (avatars, icon buttons) and 8 for a chip or a row.
   */
  radius?: number;
  /**
   * Whether the highlighted element stays clickable while the step is
   * on screen. Off by default: a tour is a read, and letting somebody
   * navigate away mid-step leaves the remaining steps pointing at a
   * page that no longer exists.
   */
  interactive?: boolean;
}

export interface Tour {
  /** Stable across releases — it is the key this browser remembers. */
  id: string;
  /**
   * Bump this when the steps change enough that somebody who has
   * already seen the tour should see it again. Anyone whose stored
   * version is lower gets the tour once more; nobody sees it twice for
   * a typo fix.
   */
  version: number;
  /** Shown in the help menu and read out as the dialog's label. */
  title: string;
  /**
   * Route patterns this tour belongs to, in react-router's syntax
   * (`/s/:locationId/book`). The first tour in the registry whose
   * pattern matches the current path wins, so order is meaningful —
   * see the note on the public slug routes in `tours.ts`.
   */
  match: readonly string[];
  steps: readonly TourStep[];
  /**
   * Skip the automatic first-visit run and leave the tour to the help
   * button. For screens somebody reaches mid-task — a checkout, a
   * confirmation — where an overlay is an interruption rather than an
   * introduction.
   */
  manualOnly?: boolean;
}
