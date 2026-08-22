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
