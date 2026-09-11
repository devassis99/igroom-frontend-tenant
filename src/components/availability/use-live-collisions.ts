import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { checkStaffAvailability, type AvailabilityDay } from "@/lib/availability-api";
import type { Collision, CollisionSide } from "@/lib/collisions-api";

/** How long to wait after the last keystroke before asking the server. */
const DEBOUNCE_MS = 300;

/**
 * How long to wait for an answer before giving up on it.
 *
 * A rejected request is easy: it sets "failed", and the bar re-enables
 * Save and falls back to the server-side refusal. A request that simply
 * never answers — a stalled connection, the tab waking from sleep — has
 * no such moment, and fetch has no timeout of its own, so without this
 * the bar reads "Checking the other shops…" with Save dead for as long
 * as the page is open. Generous rather than tight: this is the last
 * resort, not a latency budget.
 */
const TIMEOUT_MS = 10_000;

export type LiveCollisionStatus = "idle" | "checking" | "ready" | "failed";

export interface LiveCollisions {
  /**
   * Overlaps that would refuse *this* save, judged against the other
   * shops as they are stored. The only list allowed to disable Save.
   */
  blockers: Collision[];
  /**
   * Blockers the manager has already dealt with — in another tab, and
   * not saved.
   *
   * A subset of `blockers`, so they still refuse this save; what they
   * need is not another fix but the other tab saved first. Worth telling
   * apart, because "Monday clashes with Valencia" is unhelpful to
   * somebody who has just trimmed Valencia and can see it on screen.
   */
  resolvedElsewhere: Collision[];
  /**
   * Overlaps that exist only because of unsaved hours at another tab.
   *
   * Real, and about to be somebody's problem, but not this save's: the
   * server has never seen those hours, so it would accept the shop on
   * screen quite happily. Reported so a clash doesn't appear on one tab
   * and vanish on the next; kept out of `blockers` so it can't disable a
   * Save that would have worked.
   */
  pending: Collision[];
  /** Travel-buffer findings. Worth checking, never blocking. */
  warnings: Collision[];
  status: LiveCollisionStatus;
  /** Re-runs immediately, skipping the debounce. */
  refresh: () => void;
}

/** A week as one comparable string, so the effect below re-runs on the hours changing rather than on React handing it a new array. */
function weekPrint(week: AvailabilityDay[]): string {
  return week
    .map(
      (day) => `${day.dayOfWeek}:${day.ranges.map((r) => `${r.startTime}-${r.endTime}`).join(",")}`,
    )
    .join("|");
}

/**
 * Identifies a clash across the two lists an answer carries.
 *
 * Both describe the same member over the same eight weeks, so a clash is
 * "the same one" when it is the same pair of windows on the same date —
 * which is exactly what a screen means when it asks whether the thing it
 * is looking at is still there in the other list.
 */
function collisionKey(collision: Collision): string {
  return [
    collision.kind,
    collision.date,
    collision.fromAt,
    collision.toAt,
    ...[...collision.sides]
      .sort((a, b) => (a.locationId < b.locationId ? -1 : 1))
      .map((side) => `${side.locationId}:${side.startAt}:${side.endAt}`),
  ].join("|");
}

/** This shop's half of a clash, if it has one. */
export function sideAt(collision: Collision, locationId: string | null): CollisionSide | null {
  if (!locationId) return null;
  return collision.sides.find((side) => side.locationId === locationId) ?? null;
}

/** The other shop's half — the one being collided with. */
export function otherSideOf(collision: Collision, locationId: string | null): CollisionSide | null {
  if (!locationId) return null;
  return collision.sides.find((side) => side.locationId !== locationId) ?? null;
}

/**
 * The weekday a collision falls on *at the shop being edited*.
 *
 * A clash is two sides and only one of them is on this screen. The panel
 * has to hang off the row the manager can actually act on, so the day is
 * read from this shop's side and its own local date — never from
 * `collision.date`, which is the UTC day the two windows share and can
 * be the day before or after the one that was typed.
 *
 * Null when this shop's side isn't a weekly rule, which is what a clash
 * against a date override or a real booking looks like: real, counted by
 * the bar, but with no row here to sit under.
 */
export function editableDayOfWeek(collision: Collision, locationId: string | null): number | null {
  const side = sideAt(collision, locationId);
  if (!side || side.source !== "weekly") return null;
  return new Date(`${side.localDate}T00:00:00Z`).getUTCDay();
}

/**
 * The last non-empty value, kept after the real one has gone.
 *
 * Anything that closes needs its content for as long as the closing
 * takes. A day's clash panel is rendered from a clash that, the moment
 * it is fixed, is no longer there — so without this the panel's contents
 * disappear on the same frame the height starts animating, and what
 * closes is an empty box. Holding the last one lets it close saying the
 * thing it was saying.
 */
export function useRetained<T>(value: T | undefined): T | undefined {
  const held = useRef<T | undefined>(undefined);
  if (value !== undefined) held.current = value;
  return value ?? held.current;
}

/**
 * What the collision guard says about the week currently in the form,
 * asked while it is being typed.
 *
 * The whole point of this hook is *when* it runs. The same check has
 * always existed on the save — checkAvailabilitySave in the backend,
 * reached by PUT — but a manager only ever met it after pressing a
 * button, as a refusal, with no way to know beforehand that the button
 * was going to fail. Here the same resolver answers on a debounce, so
 * "Monday can't save" is on screen while Monday is still the thing being
 * looked at.
 *
 * It asks the server rather than re-deriving the answer in the browser
 * on purpose. Two implementations of one rule drift, and the one that
 * matters is the one that refuses the save; and half of what the guard
 * reads — this member's real bookings at the other shops, their date
 * overrides — is not in the browser at all.
 *
 * Failure is not fatal and deliberately not loud. If the check can't be
 * reached the form behaves exactly as it did before this existed: Save
 * is enabled, and the server-side refusal catches what it always caught.
 * An editor that won't let you save because a warning endpoint is down
 * is worse than one that warns you late.
 */
export function useLiveCollisions({
  accessToken,
  staffUserId,
  locationId,
  days,
  pending,
  enabled = true,
}: {
  accessToken: string | null;
  staffUserId: string;
  locationId: string | null;
  /** The week as it stands in the form — saved or not. */
  days: AvailabilityDay[];
  /** Unsaved weeks at the member's other shops, so a clash between two tabs is visible from both. */
  pending: { locationId: string; days: AvailabilityDay[] }[];
  enabled?: boolean;
}): LiveCollisions {
  const [answer, setAnswer] = useState<{ collisions: Collision[]; withPending: Collision[] }>({
    collisions: [],
    withPending: [],
  });
  const [status, setStatus] = useState<LiveCollisionStatus>("idle");
  const [nonce, setNonce] = useState(0);

  /**
   * The request in flight, so a newer week can cancel an older question.
   * Without it a slow answer about the week two keystrokes ago can land
   * after a fast answer about the current one and put a stale clash back
   * on screen.
   */
  const inFlight = useRef<AbortController | null>(null);

  // The week as a string, so the effect below re-runs when the *hours*
  // change rather than whenever React hands it a new array — which is
  // every render, and would mean a request per render.
  const fingerprint = useMemo(
    () =>
      [
        weekPrint(days),
        ...[...pending]
          .sort((a, b) => (a.locationId < b.locationId ? -1 : 1))
          .map((week) => `${week.locationId}=${weekPrint(week.days)}`),
      ].join("¶"),
    [days, pending],
  );
  // Read inside the effect but deliberately not a dependency of it: the
  // fingerprint is what decides when to ask, and depending on the array
  // too would fire a second identical request on every render.
  const daysRef = useRef(days);
  daysRef.current = days;
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled || !accessToken || !staffUserId || !locationId) {
      setAnswer({ collisions: [], withPending: [] });
      setStatus("idle");
      return;
    }

    // Deliberately not cleared here. The bar keeps the last answer while
    // the next one is on its way, so a clash doesn't blink out of
    // existence on every keystroke and come back 300 ms later — it is
    // still true until the server says otherwise.
    setStatus("checking");

    const controller = new AbortController();
    inFlight.current = controller;
    let stall: ReturnType<typeof setTimeout> | undefined;

    const timer = setTimeout(() => {
      // The answer stops being worth waiting for eventually, and the
      // abort is what turns a stall into the "failed" state that gives
      // the manager their Save button back.
      stall = setTimeout(() => {
        if (controller.signal.aborted) return;
        controller.abort();
        setAnswer({ collisions: [], withPending: [] });
        setStatus("failed");
      }, TIMEOUT_MS);

      void (async () => {
        try {
          const result = await checkStaffAvailability(
            accessToken,
            staffUserId,
            locationId,
            daysRef.current,
            pendingRef.current,
            controller.signal,
          );
          if (controller.signal.aborted) return;
          setAnswer(result);
          setStatus("ready");
        } catch (err: unknown) {
          // An abort is this hook cancelling itself, not a failure —
          // whatever replaced this run owns the status now.
          if (controller.signal.aborted || (err as Error)?.name === "AbortError") return;
          setAnswer({ collisions: [], withPending: [] });
          setStatus("failed");
        } finally {
          clearTimeout(stall);
        }
      })();
    }, DEBOUNCE_MS);

    /**
     * Cancel the question as well as the timer.
     *
     * Aborting from inside the *next* run instead left a window: switch
     * tab and the previous shop's request is still live for another
     * 300 ms, and if it lands in that window it writes another shop's
     * clashes into this one's bar — red, Save dead, and no panel
     * anywhere to explain it, because none of those sides belong to the
     * shop now on screen. The early return above (no token, or a member
     * down to one shop) had the same hole and no timer to clear at all.
     */
    return () => {
      clearTimeout(timer);
      clearTimeout(stall);
      controller.abort();
    };
  }, [accessToken, staffUserId, locationId, fingerprint, enabled, nonce]);

  // Cancel whatever is outstanding when the editor goes away, so a late
  // answer can't set state on something that has unmounted.
  useEffect(() => () => inFlight.current?.abort(), []);

  return useMemo(() => {
    // The two lists are the same question asked of two different
    // worlds — what is stored, and what is on screen — so the whole
    // taxonomy is which of them a clash appears in.
    const blockers = answer.collisions.filter((c) => c.kind === "overlap");
    const stillThere = new Set(answer.withPending.map(collisionKey));
    const wouldBlock = new Set(answer.collisions.map(collisionKey));

    return {
      blockers,
      // Gone once the form is taken as a whole: the manager has already
      // cut one side of it somewhere they haven't saved.
      resolvedElsewhere: blockers.filter((c) => !stillThere.has(collisionKey(c))),
      // Only there once the form is taken as a whole: typed, not stored.
      pending: answer.withPending.filter(
        (c) => c.kind === "overlap" && !wouldBlock.has(collisionKey(c)),
      ),
      // Judged on what the save will meet, like the blockers — the
      // accept-this-warning flag it feeds is about a real save.
      warnings: answer.collisions.filter((c) => c.kind === "travel"),
      status,
      refresh,
    };
  }, [answer, status, refresh]);
}
