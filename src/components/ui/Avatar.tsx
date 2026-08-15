interface AvatarProps {
  initials: string;
  color: string;
  size?: number;
}

/** Initials chip used for staff/customer avatars — the mockup draws these as flat color circles, no photos. */
export function Avatar({ initials, color, size = 32 }: AvatarProps) {
  return (
    <div
      style={{ width: size, height: size, background: color, fontSize: Math.round(size * 0.36) }}
      className="flex flex-none items-center justify-center rounded-full font-sans font-semibold text-tn-on-dark"
    >
      {initials}
    </div>
  );
}

export default Avatar;
