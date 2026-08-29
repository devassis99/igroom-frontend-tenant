import { Link } from "react-router";
import { Button } from "@/components/ui/Button";
import { zoneAbbreviation } from "@/lib/timezones";
import type { Collision, CollisionCode, CollisionSide } from "@/lib/collisions-api";

const MINUTES_PER_DAY = 24 * 60;

/** Minutes past UTC midnight, for positioning a bar on the 00Z-24Z track. */
function minutesIntoUtcDay(iso: string, dayStartIso: string): number {
  const day = new Date(dayStartIso).getTime();
  return Math.max(0, Math.round((new Date(iso).getTime() - day) / 60_000));
}

function hoursAndMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * One row of the chart — a shop's window, drawn against the same
 * 00Z-24Z track as every other row.
 *
 * A shared track is the whole argument the panel is making: two bars
 * that a manager knows as "11 in the morning" and "4 in the afternoon"
 * sit on top of each other here, and no amount of staring at either
 * shop's own screen would have shown that.
 */
function Bar({
  label,
  fromIso,
  toIso,
  dayStartIso,
  tone,
}: {
  label: string;
  fromIso: string;
  toIso: string;
  dayStartIso: string;
  tone: "a" | "b" | "clash";
}) {
  const start = minutesIntoUtcDay(fromIso, dayStartIso);
  const end = Math.min(MINUTES_PER_DAY, minutesIntoUtcDay(toIso, dayStartIso));
  const left = (start / MINUTES_PER_DAY) * 100;
  const width = Math.max(0.5, ((end - start) / MINUTES_PER_DAY) * 100);
  const fill =
    tone === "a" ? "bg-tn-success" : tone === "b" ? "bg-tn-danger" : "bg-tn-danger-strong";

  return (
    <div className="flex items-center gap-3">
      <span className="w-[190px] flex-none font-sans text-[11px] text-tn-ink-soft">{label}</span>
      <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-tn-neutral-bg">
        <span
          className={`absolute inset-y-0 rounded-full ${fill}`}
          style={{ left: `${left}%`, width: `${width}%` }}
        />
      </div>
    </div>
  );
}

/** How one side of a clash reads: the rule as typed, then what it resolves to. */
function sideLabel(side: CollisionSide): string {
  return `${side.locationName} ${side.localStart}–${side.localEnd} ${zoneAbbreviation(side.timezone)}`;
}

export interface CollisionPanelProps {
  /** What the refusal was: DOUBLE_BOOKED can only be trimmed, TRAVEL_BUFFER can also be waved through. */
  code: CollisionCode;
  collisions: Collision[];
  /**
   * Shops the editor behind this panel can actually write to.
   *
   * Both shops on Settings › Availability, which draws a tab per shop;
   * only the one on a location's own Availability tab, which is pinned
   * to it. Without this the panel offered to trim a shop that wasn't on
   * screen — the edit went into a week nothing rendered and nothing
   * could save, so the button looked like it worked and did nothing.
   */
  editableLocationIds: string[];
  /**
   * Where to send someone whose remedy isn't available here. Set on a
   * location's tab, where the other half of the clash lives on a screen
   * this one can't reach.
   */
  resolveHref?: string;
  /**
   * Trim one side back so the two stop colliding. Given the side to keep
   * and the side to cut; the editor works out the new hours, because it
   * is the thing holding the week being edited.
   *
   * Absent when neither side is editable from here — a clash against a
   * real booking, say, which has to be moved on the calendar instead.
   */
  onTrim?: (keep: CollisionSide, trim: CollisionSide, collision: Collision) => void;
  /** Offered only for a travel warning. */
  onSaveAnyway?: () => void;
  saving?: boolean;
  onDismiss?: () => void;
}

/**
 * "Can't save these hours" — the guard's refusal, shown where the edit
 * was made.
 *
 * The bar chart is doing the explaining, not the sentence above it. A
 * manager who has just typed two perfectly sensible sets of hours does
 * not believe a message telling them the hours are wrong; they believe a
 * picture of both windows on one clock with the shared band underneath.
 * So the chart comes first and the prose is short.
 *
 * The two buttons are the whole remedy: pick which shop keeps the
 * window, and the other is cut back to fit. That is offered rather than
 * "go and fix it yourself" because the arithmetic — resolve, subtract,
 * convert back into the other shop's wall clock — is exactly the thing
 * the manager just got wrong, and it is not reasonable to ask them to do
 * it by hand as the price of being told.
 */
export function CollisionPanel({
  code,
  collisions,
  editableLocationIds,
  resolveHref,
  onTrim,
  onSaveAnyway,
  saving,
  onDismiss,
}: CollisionPanelProps) {
  const primary = collisions[0];
  if (!primary) return null;

  const [a, b] = primary.sides;
  if (!a || !b) return null;

  const dayStartIso = `${primary.date}T00:00:00.000Z`;
  // The server's verdict, not a re-derivation from the window: DOUBLE_BOOKED
  // is refused however many times it is sent, TRAVEL_BUFFER can be
  // accepted. Reading `kind` off the first collision instead would get
  // this wrong the moment a save carries both.
  const isOverlap = code === "DOUBLE_BOOKED";

  /**
   * A side can only be trimmed from here if this screen both holds it
   * and can save it. A booking is moved on the calendar; an override is
   * edited in its own panel; and a shop the current editor isn't showing
   * has to be opened where it can be — which is what resolveHref is for.
   */
  const trimmable = (side: CollisionSide) =>
    side.source === "weekly" && editableLocationIds.includes(side.locationId);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-tn-danger/40 bg-tn-danger-bg px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="m-0 font-sans text-sm font-semibold text-tn-danger">
            {isOverlap ? "Can’t save these hours" : "These shifts leave no time to travel"}
          </p>
          <p className="m-0 mt-1 font-sans text-xs leading-relaxed text-tn-ink-soft">
            {isOverlap ? (
              <>
                Bookable at <span className="font-semibold">{a.locationName}</span> and{" "}
                <span className="font-semibold">{b.locationName}</span> at the same moment on{" "}
                {primary.date}, {primary.window}. Both look right locally. Pick one shop for that
                window, or split the day.
              </>
            ) : (
              <>
                {primary.gapMinutes === 0 ? "No gap" : hoursAndMinutes(primary.gapMinutes)} between{" "}
                <span className="font-semibold">{a.locationName}</span> and{" "}
                <span className="font-semibold">{b.locationName}</span> on {primary.date}, and this
                account allows {primary.requiredGapMinutes} min to get between shops.
              </>
            )}
          </p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="cursor-pointer rounded-md border-none bg-transparent px-1 font-sans text-base leading-none text-tn-muted-5 hover:text-tn-ink"
          >
            ×
          </button>
        )}
      </div>

      {/* Everything resolved onto one clock. The row labels keep the
          local times so the manager can still find the fields they
          typed; the bars are the only thing drawn to scale. */}
      <div className="flex flex-col gap-2">
        <p className="m-0 font-sans text-[11px] font-semibold text-tn-ink">
          {new Date(dayStartIso).toLocaleDateString("en-US", {
            weekday: "long",
            timeZone: "UTC",
          })}
          , resolved to UTC
        </p>
        <Bar
          label={sideLabel(a)}
          fromIso={a.startAt}
          toIso={a.endAt}
          dayStartIso={dayStartIso}
          tone="a"
        />
        <Bar
          label={sideLabel(b)}
          fromIso={b.startAt}
          toIso={b.endAt}
          dayStartIso={dayStartIso}
          tone="b"
        />
        <Bar
          label={
            isOverlap
              ? `Collision · ${hoursAndMinutes(primary.overlapMinutes)}`
              : `Gap · ${primary.gapMinutes === 0 ? "none" : hoursAndMinutes(primary.gapMinutes)}, needs ${primary.requiredGapMinutes} min`
          }
          fromIso={primary.fromAt}
          toIso={primary.toAt}
          dayStartIso={dayStartIso}
          tone="clash"
        />
        <div className="ml-[202px] flex justify-between font-mono text-[10px] text-tn-muted-6">
          <span>00Z</span>
          <span>06Z</span>
          <span>12Z</span>
          <span>18Z</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {onTrim && trimmable(b) && (
          <Button size="sm" disabled={saving} onClick={() => onTrim(a, b, primary)}>
            Keep {a.locationName}, trim {b.locationName}
          </Button>
        )}
        {onTrim && trimmable(a) && (
          <Button
            variant="secondary"
            size="sm"
            disabled={saving}
            onClick={() => onTrim(b, a, primary)}
          >
            Keep {b.locationName}, trim {a.locationName}
          </Button>
        )}
        {/* Offered only for travel, and only ever as the third option —
            the manager may know she gets a lift, but the default should
            be to fix the schedule rather than to overrule it. */}
        {onSaveAnyway && !isOverlap && (
          <Button variant="secondary" size="sm" disabled={saving} onClick={onSaveAnyway}>
            {saving ? "Saving…" : "Save anyway"}
          </Button>
        )}
        {/* The way out when the remedy isn't here. On a location's own
            Availability tab only that shop is editable, so at most one
            of the two trims above can exist — resolving the clash by
            cutting the *other* shop means going where both are on
            screen. */}
        {resolveHref && (
          <Link
            to={resolveHref}
            className="rounded-lg border border-tn-input-border bg-tn-surface px-3 py-1.5 font-sans text-[13px] font-semibold text-tn-ink no-underline hover:bg-tn-neutral-bg"
          >
            {trimmable(a) || trimmable(b)
              ? "Open both shops in Settings › Availability"
              : "Fix in Settings › Availability"}
          </Link>
        )}

        {!trimmable(a) && !trimmable(b) && !resolveHref && (
          <p className="m-0 font-sans text-xs text-tn-muted-5">
            Neither side can be edited here —{" "}
            {a.source === "booking" || b.source === "booking"
              ? "one of these is a real booking, so move it on the calendar"
              : "one of these is a date override, so edit it in the panel beside the grid"}
            .
          </p>
        )}
      </div>

      {collisions.length > 1 && (
        <p className="m-0 font-sans text-xs text-tn-muted-5">
          {collisions.length - 1} more {collisions.length === 2 ? "clash" : "clashes"} in the next
          eight weeks. Fixing this one usually clears the repeats, since they come from the same
          weekly rule.
        </p>
      )}
    </section>
  );
}

export default CollisionPanel;
