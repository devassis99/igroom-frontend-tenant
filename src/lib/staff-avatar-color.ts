/**
 * Deterministic flat avatar-circle color for a staff id — same person
 * always gets the same color across renders/sessions without persisting
 * anything, and different people spread out across the hue wheel instead
 * of clustering. Matches the "Day view — merged proposal" mockup's own
 * avatar treatment (a plain colored circle, no initials/photo).
 */
export function staffAvatarColor(staffUserId: string): string {
  let hash = 0;
  for (let i = 0; i < staffUserId.length; i++) {
    hash = (hash * 31 + staffUserId.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `oklch(88% 0.04 ${hue})`;
}

/**
 * The same hue, dark enough to carry white initials.
 *
 * `staffAvatarColor` above is a pale fill for a circle with nothing in
 * it — the Day view's calendar dots. The waitlist's chips print the
 * member's initials inside, and white on an 88%-lightness background is
 * somewhere around a 1.2:1 contrast ratio, which is to say invisible.
 * Same hash so the same person is recognisably the same colour in both
 * places.
 */
export function staffAvatarColorStrong(staffUserId: string): string {
  let hash = 0;
  for (let i = 0; i < staffUserId.length; i++) {
    hash = (hash * 31 + staffUserId.charCodeAt(i)) >>> 0;
  }
  return `oklch(52% 0.11 ${hash % 360})`;
}
