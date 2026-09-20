/**
 * In-app tours: the short, skippable walkthrough each screen shows the
 * first time somebody opens it.
 *
 * Three things go into a screen having one, and only the first is code:
 *
 *  1. The shell renders `<TourProvider />` once (AppShell already does,
 *     and so does the staff welcome wizard, which sits outside it).
 *     Pages never mount it themselves.
 *  2. The screen's steps are written in `tours.ts`, matched to its
 *     route. A step with no `anchor` is a centred card introducing the
 *     page, and every tour opens with one.
 *  3. Anything a step points at carries `data-tour="..."` — a plain
 *     attribute, so a page opts in with one word and nothing imports
 *     anything.
 *
 * `README.md` in this folder is the longer version: how to add a tour to
 * a new screen, and the mistakes that are easy to make.
 */
export { TourProvider, useTour } from "./TourProvider";
export { TourHelpButton } from "./TourHelpButton";
export { TourTipsCard } from "./TourTipsCard";
export { findTourForPath } from "./find-tour";
export { TOURS, TOURS_BY_ID } from "./tours";
export { useTourStore } from "./tour-store";
export type { Tour, TourStep, TourPlacement } from "./types";
