import { forwardRef } from "react";
import { Link } from "react-router";
import { Collapsible } from "@/components/ui/Collapsible";
import { zoneAbbreviation } from "@/lib/timezones";
import type { Collision, CollisionSide } from "@/lib/collisions-api";

const MINUTES_PER_DAY = 24 * 60;

/** Minutes from the start of the track. */
function minutesFrom(iso: string, trackStartIso: string): number {
  return Math.round((new Date(iso).getTime() - new Date(trackStartIso).getTime()) / 60_000);
}

/**
 * The stretch of UTC the chart has to cover.
 *
 * A fixed 00Z-24Z track was wrong for exactly the case the chart exists
 * to explain. Two shops far enough apart put one of the windows on the
 * next UTC day — that is the whole point being made — and a bar outside
 * the track collapsed to a stub at the left edge, drawing a picture that
 * disproved the sentence above it. So the track starts at UTC midnight
 * before the earliest window and runs in whole days until it covers the
 * latest.
 */
function trackFor(instants: string[]): { startIso: string; minutes: number } {
  const times = instants.map((iso) => new Date(iso).getTime());
  const first = Math.min(...times);
  const last = Math.max(...times);
  const start = Date.UTC(
    new Date(first).getUTCFullYear(),
    new Date(first).getUTCMonth(),
    new Date(first).getUTCDate(),
  );
  const spanMinutes = Math.ceil((last - start) / 60_000);
  const days = Math.max(1, Math.ceil(spanMinutes / MINUTES_PER_DAY));
  return { startIso: new Date(start).toISOString(), minutes: days * MINUTES_PER_DAY };
}

/** Four evenly spaced UTC labels under the track, whatever it spans. */
function trackTicks(startIso: string, minutes: number): { at: number; label: string }[] {
  const start = new Date(startIso).getTime();
  return [0, 1, 2, 3].map((i) => {
    // The offset doubles as the key — a 48-hour track repeats "00Z", and
    // two identical labels can't both key off their text.
    const offset = (minutes / 4) * i;
    const at = new Date(start + offset * 60_000);
    return { at: offset, label: `${String(at.getUTCHours()).padStart(2, "0")}Z` };
  });
}

export function hoursAndMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * One row of the chart — a shop's window against the same 00Z-24Z track
 * as every other row.
 *
 * The shared track is the argument the panel is making: two bars a
 * manager knows as "11 in the morning" and "4 in the afternoon" sit on
 * top of each other here, and no amount of staring at either shop's own
 * screen would have shown that. Lifted unchanged from CollisionPanel,
 * which is still the backstop for a save the server refuses.
 */
function Bar({
  label,
  fromIso,
  toIso,
  track,
  tone,
}: {
  label: string;
  fromIso: string;
  toIso: string;
  track: { startIso: string; minutes: number };
  tone: "a" | "b" | "clash";
}) {
  const start = Math.max(0, minutesFrom(fromIso, track.startIso));
  const end = Math.min(track.minutes, minutesFrom(toIso, track.startIso));
  const left = (start / track.minutes) * 100;
  const width = Math.max(0.5, ((end - start) / track.minutes) * 100);
  const fill =
    tone === "a" ? "bg-tn-success" : tone === "b" ? "bg-tn-danger" : "bg-tn-danger-strong";

  return (
    <div className="flex items-center gap-3">
      <span className="w-[104px] flex-none truncate font-sans text-[11px] text-tn-ink-soft sm:w-[150px]">
        {label}
      </span>
      <div className="relative h-3.5 flex-1 overflow-hidden rounded-full bg-tn-neutral-bg">
        <span
          className={`absolute inset-y-0 rounded-full ${fill}`}
          style={{ left: `${left}%`, width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function sideLabel(side: CollisionSide): string {
  return `${side.locationName} ${side.localStart}–${side.localEnd} ${zoneAbbreviation(side.timezone)}`;
}

export interface DayClashPanelProps {
  /**
   * Whether this row still has a clash.
   *
   * False keeps the panel mounted and closes it, rather than pulling it
   * out of the list — a fix that makes the panel vanish on the frame the
   * button is pressed gives no sense that the thing was resolved, only
   * that the page jumped. The collision stays on its last value while it
   * closes (see useRetained).
   */
  open: boolean;
  /** The clash this panel is about. Always the one belonging to the row directly above it. */
  collision: Collision;
  /** The shop whose tab is open — decides which side is "here" and which is the one being collided with. */
  activeLocationId: string;
  /** Collapsed is a single line; expanded is the chart and the two fixes. */
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  /**
   * Apply a fix: keep one side's day, cut the other back to fit. The
   * editor does the arithmetic, because it is the thing holding the week
   * — this panel only says which side won.
   */
  onFix: (keep: CollisionSide, trim: CollisionSide, collision: Collision) => void;
  /** Shops this editor can actually write to. A side outside this list can be named but not trimmed from here. */
  editableLocationIds: string[];
  /** Where to go when the remedy isn't on this screen — set on a location's own tab, which is pinned to one shop. */
  resolveHref?: string;
  /** How many other days on this tab carry the same clash, for the footnote. */
  repeats?: number;
  /**
   * Which kind of clash this is — see ClashMode in
   * StaffAvailabilityEditor.
   *
   * The three read very differently to somebody in the middle of the
   * work. "blocks" is a clash nobody has dealt with. "needs-other-save"
   * is one they have already cut on another tab, where the remedy is not
   * another fix but saving that tab. "unsaved-elsewhere" can't refuse
   * *this* save at all, because the hours it collides with have never
   * been stored — and saying "can't save" about a week that saves
   * perfectly well is how people learn to ignore the colour.
   */
  mode?: "blocks" | "needs-other-save" | "unsaved-elsewhere";
  /** Take the manager to the tab that has to be saved first. Set for "needs-other-save". */
  onOpenOtherTab?: () => void;
}

/**
 * Component B — the clash, explained where it was caused.
 *
 * It lives in the day list as a sibling of the row it belongs to, not in
 * a modal and not at the top of the page. That placement is the whole
 * design: the row above it holds the fields that caused this, and both
 * the explanation and the two fixes are within one glance of them. A
 * modal would cover the very thing being discussed, and a banner at the
 * top would name a day that is somewhere else on screen.
 *
 * Collapsed, it is one red line — enough to mark the row, and enough of
 * an anchor for the bar's Review button to scroll to. Expanded, it is
 * the sentence a manager cannot work out for themselves (both sets of
 * hours look right locally; in UTC they land on top of each other), the
 * chart that proves it, and two buttons named after the shop that keeps
 * the day rather than after the operation performed.
 */
export const DayClashPanel = forwardRef<HTMLDivElement, DayClashPanelProps>(function DayClashPanel(
  {
    open,
    collision,
    activeLocationId,
    expanded,
    onExpand,
    onCollapse,
    onFix,
    editableLocationIds,
    resolveHref,
    repeats = 0,
    mode = "blocks",
    onOpenOtherTab,
  },
  ref,
) {
  const here = collision.sides.find((side) => side.locationId === activeLocationId);
  const there = collision.sides.find((side) => side.locationId !== activeLocationId);
  if (!here || !there) return null;

  const isOverlap = collision.kind === "overlap";
  const unsaved = mode === "unsaved-elsewhere";
  const needsOtherSave = mode === "needs-other-save";
  // Amber is "check this"; red is "this stops the save". An overlap with
  // hours nobody has saved yet is the first, however real it is.
  const blocks = isOverlap && !unsaved;
  const track = trackFor([
    here.startAt,
    here.endAt,
    there.startAt,
    there.endAt,
    collision.fromAt,
    collision.toAt,
  ]);
  const weekday = new Date(`${here.localDate}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
  const size = isOverlap
    ? hoursAndMinutes(collision.overlapMinutes)
    : collision.gapMinutes === 0
      ? "no gap"
      : hoursAndMinutes(collision.gapMinutes);

  /**
   * A side can only be cut from here if this screen both holds it and
   * can save it. A booking is moved on the calendar; an override is
   * edited in its own panel beside the grid; a shop this editor isn't
   * showing has to be opened where it is — which is what resolveHref is
   * for.
   */
  const fixable = (side: CollisionSide) =>
    side.source === "weekly" && editableLocationIds.includes(side.locationId);

  const tone = blocks
    ? "border-tn-danger/40 bg-tn-danger-bg"
    : "border-tn-gold-soft bg-tn-gold-bg-soft";

  return (
    <div ref={ref}>
      <Collapsible open={open} className="pb-3">
        <section className={`overflow-hidden rounded-xl border ${tone}`}>
          {/*
           * One header row in both states rather than two separate
           * layouts.
           *
           * Swapping a collapsed line for a whole panel meant the summary
           * vanished and a heading saying much the same thing appeared a
           * few pixels away — a jump, at the exact moment somebody has
           * asked to see more. Here the row stays put and only its wording
           * grows: collapsed it is "9h at two shops · Valencia", expanded
           * it is the full sentence, and the detail opens underneath it.
           */}
          <button
            type="button"
            onClick={expanded ? onCollapse : onExpand}
            aria-expanded={expanded}
            className="flex w-full cursor-pointer items-start justify-between gap-3 border-none bg-transparent px-4 py-2.5 text-left font-sans"
          >
            <span
              className={`text-[13px] leading-snug transition-colors duration-200 ${
                blocks ? "text-tn-danger" : "text-tn-gold"
              } ${expanded ? "font-semibold" : ""}`}
            >
              {expanded ? (
                unsaved ? (
                  `${weekday} clashes with unsaved hours at ${there.locationName}`
                ) : needsOtherSave ? (
                  `Save ${there.locationName} first — ${weekday} is fixed but not saved`
                ) : isOverlap ? (
                  `${weekday} can’t save — ${size} at two shops`
                ) : (
                  `${weekday} leaves ${size} to get between shops`
                )
              ) : (
                <>
                  <span className="font-semibold">{size}</span>{" "}
                  {unsaved
                    ? `at two shops · ${there.locationName}, unsaved`
                    : needsOtherSave
                      ? `still stored at ${there.locationName} · save that tab first`
                      : isOverlap
                        ? `at two shops · ${there.locationName}`
                        : `between shops · ${there.locationName}`}
                </>
              )}
            </span>
            <span className="flex-none font-sans text-xs font-semibold text-tn-muted-5">
              {expanded ? "Hide" : "expand"}
            </span>
          </button>

          {/* The detail grows under the header row rather than replacing
              it, so nothing jumps when somebody asks to see more. */}
          <Collapsible open={expanded} className="flex flex-col gap-3 px-4 pb-3.5">
            {/* The local-versus-UTC sentence is the part nobody can work out
                for themselves, so it is said plainly and first. */}
            <p className="m-0 font-sans text-xs leading-relaxed text-tn-ink-soft">
              {needsOtherSave ? (
                <>
                  You&rsquo;ve already cut this at{" "}
                  <span className="font-semibold">{there.locationName}</span>, but that change is
                  still sitting in the form. Until it&rsquo;s saved, {there.locationName} is on{" "}
                  {there.localStart}–{there.localEnd} as far as the booking system is concerned, and
                  saving {here.locationName} would be refused. Save {there.locationName} first, then
                  come back.
                </>
              ) : unsaved ? (
                <>
                  The {there.localStart}–{there.localEnd} you&rsquo;ve typed into{" "}
                  <span className="font-semibold">{there.locationName}</span> overlaps {weekday}{" "}
                  here — {collision.window} once both are resolved to UTC. Those hours aren&rsquo;t
                  saved yet, so this won&rsquo;t stop you saving {here.locationName}; it will be
                  refused when you save {there.locationName}. Fixing it from either tab settles it.
                </>
              ) : isOverlap ? (
                <>
                  <span className="font-semibold">{there.locationName}</span> already covers{" "}
                  {there.localStart}–{there.localEnd} on {weekday}s. Both look right locally;
                  resolved to UTC they overlap {collision.window}. One shop has to give {weekday}{" "}
                  up.
                </>
              ) : (
                <>
                  <span className="font-semibold">{there.locationName}</span> runs{" "}
                  {there.localStart}–{there.localEnd} on {weekday}s. That leaves {size} either side
                  of the hours set here, and this account allows {collision.requiredGapMinutes} min
                  to travel between shops. This is a warning — it won’t stop the save.
                </>
              )}
            </p>

            <div className="flex flex-col gap-1.5">
              <Bar
                label={sideLabel(there)}
                fromIso={there.startAt}
                toIso={there.endAt}
                track={track}
                tone="a"
              />
              <Bar
                label={sideLabel(here)}
                fromIso={here.startAt}
                toIso={here.endAt}
                track={track}
                tone="b"
              />
              <Bar
                label={isOverlap ? `Collision · ${size}` : `Gap · ${size}`}
                fromIso={collision.fromAt}
                toIso={collision.toAt}
                track={track}
                tone="clash"
              />
              <div className="ml-[116px] flex justify-between font-mono text-[10px] text-tn-muted-6 sm:ml-[162px]">
                {trackTicks(track.startIso, track.minutes).map((tick) => (
                  <span key={tick.at}>{tick.label}</span>
                ))}
                <span>{track.minutes > MINUTES_PER_DAY ? "next day" : "24Z"}</span>
              </div>
            </div>

            {/* Two outcomes, not two operations. Each button is named after
                the shop that keeps the day, because that is the choice being
                made; what it costs is underneath it. */}
            {needsOtherSave && onOpenOtherTab && (
              <button
                type="button"
                data-clash-fix="first"
                onClick={onOpenOtherTab}
                className="w-fit cursor-pointer rounded-xl border border-tn-input-border bg-tn-surface px-3.5 py-2.5 text-left font-sans text-[13px] font-semibold text-tn-ink hover:bg-tn-neutral-bg"
              >
                Open {there.locationName} to save it
              </button>
            )}

            {isOverlap && !needsOtherSave && (
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {fixable(here) && (
                  <button
                    type="button"
                    data-clash-fix="first"
                    onClick={() => onFix(there, here, collision)}
                    className="flex-1 cursor-pointer rounded-xl border border-tn-input-border bg-tn-surface px-3.5 py-2.5 text-left font-sans hover:bg-tn-neutral-bg"
                  >
                    <span className="block text-[13px] font-semibold text-tn-ink">
                      {there.locationName} keeps {weekday}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-tn-muted-5">
                      {weekday} turns off at {here.locationName}
                    </span>
                  </button>
                )}
                {fixable(there) && (
                  <button
                    type="button"
                    data-clash-fix={fixable(here) ? undefined : "first"}
                    onClick={() => onFix(here, there, collision)}
                    className="flex-1 cursor-pointer rounded-xl border border-tn-input-border bg-tn-surface px-3.5 py-2.5 text-left font-sans hover:bg-tn-neutral-bg"
                  >
                    <span className="block text-[13px] font-semibold text-tn-ink">
                      {here.locationName} keeps {weekday}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-tn-muted-5">
                      {there.locationName} is trimmed back to clear it
                    </span>
                  </button>
                )}
                {resolveHref && !fixable(there) && (
                  <Link
                    to={resolveHref}
                    data-clash-fix={fixable(here) ? undefined : "first"}
                    className="rounded-xl border border-tn-input-border bg-tn-surface px-3.5 py-2.5 font-sans text-[13px] font-semibold text-tn-ink no-underline hover:bg-tn-neutral-bg"
                  >
                    Open both shops in Settings › Availability
                  </Link>
                )}
                {!fixable(here) && !fixable(there) && !resolveHref && (
                  <p className="m-0 font-sans text-xs text-tn-muted-5">
                    Neither side can be edited here —{" "}
                    {here.source === "booking" || there.source === "booking"
                      ? "one of these is a real booking, so move it on the calendar"
                      : "one of these is a date override, so edit it in the panel beside the grid"}
                    .
                  </p>
                )}
              </div>
            )}

            {/* Repeats have to be counted, or the same weekly rule gets
                fixed one date at a time, eight times. */}
            {repeats > 0 && (
              <p className="m-0 font-sans text-[11px] text-tn-muted-5">
                Same clash on {repeats} more {weekday}
                {repeats === 1 ? "" : "s"}. Both fixes change the weekly rule, so they clear all of
                them.
              </p>
            )}
          </Collapsible>
        </section>
      </Collapsible>
    </div>
  );
});

export default DayClashPanel;
