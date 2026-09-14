import { env } from "./env";
import type { AccountLocation } from "./locations-api";

/**
 * The link an owner hands out — what "Copy link" copies and what the QR
 * code encodes.
 *
 * Built here rather than by the backend because the answer depends on
 * where the *customer-facing* app is deployed, which this app knows from
 * its own configuration and the API does not. Two shapes, and which one
 * an owner wants depends on how many doors they have:
 *
 *   <app>/thegentry              the shop — opens its primary branch
 *   <app>/thegentry/johar-town   one particular branch
 *
 * Both are permanent, which is the whole point. The account slug is
 * fixed at signup and a branch slug is fixed when the branch is created,
 * so a link printed on a card, pasted in an Instagram bio or attached to
 * a Google listing keeps working through a rename.
 *
 * This replaces the `/l/<locationId>` shape the QR panel used while the
 * public page was still hypothetical. A uuid in a link is ours to
 * change; a slug in somebody's bio is not, and the two should never have
 * been the same string.
 */

/** Null when no public site is configured — see env.ts's VITE_BOOKING_BASE_URL. */
export function publicBookingUrl(
  accountSlug: string | null | undefined,
  branchSlug?: string | null,
): string | null {
  const base = env.VITE_BOOKING_BASE_URL;
  if (!base || !accountSlug) return null;
  const origin = base.replace(/\/+$/, "");
  return branchSlug ? `${origin}/${accountSlug}/${branchSlug}` : `${origin}/${accountSlug}`;
}

/**
 * The link for one branch — every branch, the primary included.
 *
 * The primary used to be handed the shop's bare link instead, on the
 * grounds that /thegentry already resolves to it and the shorter string
 * is the one somebody types off a poster. That was true and still is,
 * but it made the card lie by omission: a panel headed "Valencia"
 * offering a link that never says Valencia reads as a bug, and an owner
 * with three branches has no way to see that the pattern is the same for
 * all three. The short link hasn't gone anywhere — it is named on the
 * card underneath — it just isn't what "this branch's link" means.
 *
 * And it is no longer reliably the primary's. Taking bookings is per
 * branch, so a primary with its switch off is not the branch the bare
 * link opens: the resolver falls through to the first branch that is
 * taking them.
 */
export function branchBookingUrl(
  accountSlug: string | null | undefined,
  location: AccountLocation,
): string | null {
  // A branch with no slug of its own — one created before links existed,
  // and not yet backfilled — falls back to the shop's link rather than to
  // nothing. That link opens the primary branch rather than this one,
  // which is why the panel only claims a link is branch-specific when
  // there is a slug to make it so.
  return publicBookingUrl(accountSlug, location.slug);
}

/**
 * Whether the shop's bare link is a second way into *this* branch.
 *
 * True only for the primary while it is open, which is exactly when the
 * resolver sends a bare slug here. Status is the whole test: the branch's
 * own link and its listing are one switch now, not two.
 */
export function shopLinkOpensBranch(location: AccountLocation): boolean {
  return location.isPrimary && location.status === "active";
}

/** Whether this branch's link actually opens *this* branch, rather than falling back to the shop's. */
export function hasOwnBranchLink(location: AccountLocation): boolean {
  return Boolean(location.slug);
}

/** The same link without its scheme — what to show on screen, since "https://" is noise on a card. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "");
}
