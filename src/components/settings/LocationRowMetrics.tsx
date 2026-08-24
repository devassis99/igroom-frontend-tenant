import type { AccountLocation } from "@/lib/locations-api";

/** Deterministic per-id tint, same hash the staff pages use so a person keeps one colour everywhere. */
const AVATAR_COLORS = [
  "var(--color-tn-avatar-peach)",
  "var(--color-tn-avatar-tan)",
  "var(--color-tn-avatar-cream)",
  "var(--color-tn-avatar-brown)",
  "var(--color-tn-avatar-blue)",
];

function avatarColorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Overlapping heads for the roster, collapsing to "+N" past the preview the API sends. */
export function StaffStack({ location }: { location: AccountLocation }) {
  const shown = location.staffPreview;
  const overflow = location.staffCount - shown.length;

  if (location.staffCount === 0) {
    return <span className="font-sans text-xs text-tn-faint">None</span>;
  }

  return (
    <div className="flex items-center" title={`${location.staffCount} staff`}>
      {shown.map((member, index) => (
        <span
          key={member.id}
          title={member.name}
          style={{ background: avatarColorFor(member.id), marginLeft: index === 0 ? 0 : -7 }}
          className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 border-tn-surface font-sans text-[9px] font-semibold text-tn-ink-soft"
        >
          {initialsFor(member.name)}
        </span>
      ))}
      {overflow > 0 && (
        <span
          style={{ marginLeft: -7 }}
          className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 border-tn-surface bg-tn-border-softer font-sans text-[9px] font-semibold text-tn-ink-soft"
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}

/**
 * Today's booked slots against what the roster's hours actually offer.
 *
 * Reads "— " rather than "0 / 0" when nobody has hours set: a zero
 * denominator isn't 0% utilisation, it's a location that can't be booked
 * at all, and the row's setup call-to-action is what says so.
 */
export function UtilisationCell({ location }: { location: AccountLocation }) {
  if (location.slotsCapacity === 0) {
    return <span className="font-sans text-xs text-tn-faint">Not bookable</span>;
  }

  const ratio = Math.min(1, location.slotsBooked / location.slotsCapacity);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-sans text-xs font-semibold text-tn-ink">
        {location.slotsBooked} / {location.slotsCapacity} slots
      </span>
      <div className="h-[5px] overflow-hidden rounded-full bg-tn-border-softer">
        <div
          style={{ width: `${Math.round(ratio * 100)}%` }}
          className="h-full rounded-full bg-tn-gold"
        />
      </div>
    </div>
  );
}

/**
 * Seven days of takings as bars, with the week's total above them.
 *
 * Heights are relative to the busiest day in this location's own week, not
 * a shared scale — the shape of one shop's week is the readable signal
 * here, and normalising across locations would flatten a quiet branch into
 * a row of stubs.
 */
export function RevenueSparkline({ location }: { location: AccountLocation }) {
  const series = location.revenueSeries;
  const total = series.reduce((sum, day) => sum + day.cents, 0);

  if (series.length === 0 || total === 0) {
    return <span className="font-sans text-xs text-tn-faint">—</span>;
  }

  const peak = Math.max(...series.map((day) => day.cents));
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-sans text-xs font-semibold text-tn-ink">
        ${(total / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </span>
      <div className="flex h-[18px] items-end gap-[2px]">
        {series.map((day) => (
          <div
            key={day.date}
            title={`${day.date}: $${(day.cents / 100).toFixed(0)}`}
            style={{ height: `${peak === 0 ? 0 : Math.max(8, (day.cents / peak) * 100)}%` }}
            className="flex-1 rounded-[1.5px] bg-tn-gold-soft"
          />
        ))}
      </div>
    </div>
  );
}
