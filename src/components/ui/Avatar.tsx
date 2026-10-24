interface AvatarProps {
  initials: string;
  color: string;
  size?: number;
}

/**
 * The palette's three pale fills. White initials all but vanish on them
 * ("NM" on peach was close to invisible), so those get the dark ink
 * instead; the brown and blue keep white.
 */
const PALE_FILL = /--color-tn-avatar-(peach|tan|cream)\b/;

/** Initials chip used for staff/customer avatars — the mockup draws these as flat color circles, no photos. */
export function Avatar({ initials, color, size = 32 }: AvatarProps) {
  return (
    <div
      style={{ width: size, height: size, background: color, fontSize: Math.round(size * 0.36) }}
      className={`flex flex-none items-center justify-center rounded-full font-sans font-semibold ${
        PALE_FILL.test(color) ? "text-tn-ink-soft" : "text-tn-on-dark"
      }`}
    >
      {initials}
    </div>
  );
}

export default Avatar;
