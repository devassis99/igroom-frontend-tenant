import { matchPath } from "react-router";
import { TOURS } from "./tours";
import type { Tour } from "./types";

/**
 * Screens that deliberately have no tour.
 *
 * Two kinds. The marketing page and the sign-in form, where an overlay
 * would be the first thing a stranger meets and has nothing to explain
 * that the page doesn't already say. And the pass-through screens —
 * /redirecting, /signup/receipt, /invite, /support-session — which
 * nobody stays on: each one is doing a thing (redeeming a token,
 * creating the account after Stripe, bouncing onward) and is gone before
 * a tour could open.
 *
 * Listed rather than simply left out of `TOURS`, so the omission reads
 * as a decision instead of an oversight.
 */
const UNTOURED = [
  "/",
  "/login",
  "/signup",
  "/signup/receipt",
  "/invite",
  "/redirecting",
  "/support-session",
] as const;

/**
 * The tour for a path, or undefined.
 *
 * First match wins. Every route in this app is a static path, so the
 * ordering trap the customer app has (a top-level `/:slug` that matches
 * everything) doesn't exist here — but `end: true` still matters:
 * without it, `/settings` would claim `/settings/billing` and every
 * settings screen would get the profile screen's tour.
 */
export function findTourForPath(pathname: string): Tour | undefined {
  if (UNTOURED.some((path) => matchPath({ path, end: true }, pathname))) return undefined;
  return TOURS.find((tour) =>
    tour.match.some((path) => matchPath({ path, end: true }, pathname) !== null),
  );
}
