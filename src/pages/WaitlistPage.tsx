import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { LocationFilterPopover } from "@/components/ui/LocationFilterPopover";
import { AddWalkInModal } from "@/components/waitlist/AddWalkInModal";
import { SeatChairModal } from "@/components/waitlist/SeatChairModal";
import { useAuthStore } from "@/auth/auth-store";
import { ApiError } from "@/lib/http";
import { listLocations } from "@/lib/locations-api";
import { staffAvatarColorStrong } from "@/lib/staff-avatar-color";
import {
  addWalkIn,
  callInEntry,
  completeEntry,
  getWaitlistBoard,
  noShowEntry,
  cancelWaitlistEntry,
  seatEntry,
  waitlistKeys,
  type WaitingEntry,
  type WaitlistBoard,
  type WaitlistChair,
} from "@/lib/waitlist-api";

type View = "list" | "board";

/**
 * How often the board re-reads itself.
 *
 * A walk-in queue is the one screen in this app that is genuinely wrong
 * the moment it stops moving: somebody joins from their phone in the
 * doorway, another branch's manager calls a name, a barber finishes
 * early. Fifteen seconds is short enough that the desk trusts it and
 * long enough that a machine left open all day isn't hammering the API.
 */
const POLL_MS = 15_000;

/** Circumference of the progress ring below, for r=46 on a 100×100 viewBox. */
const RING_CIRCUMFERENCE = 2 * Math.PI * 46;

/**
 * Read at the moment the ring draws rather than through a hook.
 *
 * The CSS already switches the transition off under this preference, but
 * the ring also needs to skip its deliberately-empty first frame —
 * otherwise somebody who asked for less motion gets a flash of an empty
 * ring snapping to full, which is more motion than they'd have had.
 */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

function errorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) return error.message;
  return "Something went wrong. Try again.";
}

/** "8 min left", or "3 min over" once an appointment runs past its slot — which the desk needs to see. */
function chairTimeLabel(minutesLeft: number | null): { text: string; over: boolean } {
  if (minutesLeft === null) return { text: "In progress", over: false };
  if (minutesLeft < 0) return { text: `${Math.abs(minutesLeft)} min over`, over: true };
  return { text: `${minutesLeft} min left`, over: false };
}

/** T8 / T8b Live Waitlist — the front desk's view of the walk-in queue, backed by /waitlist. */
export function WaitlistPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("list");
  /**
   * Which way the next view should come in from. Board sits to the right
   * of List in the control, so moving to it slides in from the right and
   * moving back slides in from the left — the switch reads as a move
   * along a track rather than a page replacement.
   */
  const [viewDirection, setViewDirection] = useState<"forward" | "back">("forward");
  const [chosenLocationId, setChosenLocationId] = useState<string | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [seatTarget, setSeatTarget] = useState<WaitingEntry | null>(null);

  const changeView = (next: View) => {
    setViewDirection(next === "board" ? "forward" : "back");
    setView(next);
  };

  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: () => listLocations(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });
  /**
   * Only the branches this caller can actually act on.
   *
   * GET /locations returns every shop on the account with an `inScope`
   * flag, because the Locations admin page and the member picker both
   * need the full list. Every read and write on *this* page is
   * branch-scoped, so offering a shop the waitlist endpoint will refuse
   * is a 403 with extra steps — which is precisely what it was:
   * defaulting to the account's primary branch dropped a single-branch
   * receptionist onto somebody else's shop and showed them "that
   * location isn't one of yours" instead of their own queue.
   *
   * CalendarPage and HoursSettingsPage already filter this way; this
   * page copied the default-selection logic from the calendar without
   * the filter that precedes it.
   */
  const allLocations = useMemo(() => locationsQuery.data?.locations ?? [], [locationsQuery.data]);
  const locations = useMemo(() => allLocations.filter((l) => l.inScope), [allLocations]);

  /**
   * Same "the primary one, else the first" default the calendar uses,
   * but derived rather than pushed into state by an effect.
   *
   * The effect version sets state during the render that first sees the
   * locations, which costs a second render pass on every mount and — on
   * a screen that re-reads itself every fifteen seconds — is exactly the
   * shape that turns into a render loop the first time somebody adds a
   * dependency to it. Deriving it means there is no moment where the
   * page has locations and no selection.
   */
  const defaultLocationId = useMemo(
    () => locations.find((l) => l.isPrimary)?.id ?? locations[0]?.id ?? "",
    [locations],
  );
  const selectedLocationId = chosenLocationId ?? defaultLocationId;

  const boardQuery = useQuery({
    queryKey: waitlistKeys.board(selectedLocationId),
    queryFn: () => getWaitlistBoard(accessToken ?? "", selectedLocationId),
    enabled: Boolean(accessToken && selectedLocationId),
    refetchInterval: POLL_MS,
    // Keeps the previous branch's board on screen while a new one loads,
    // so switching locations doesn't blank the page.
    placeholderData: keepPreviousData,
  });
  const board = boardQuery.data;

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: waitlistKeys.board(selectedLocationId) });

  /**
   * Seating and completing both write to the calendar as well as the
   * queue, so the bookings caches are invalidated too — otherwise a
   * walk-in seated here doesn't appear on the calendar until something
   * else happens to refetch it.
   */
  const invalidateEverything = async () => {
    await refresh();
    await queryClient.invalidateQueries({ queryKey: ["bookings"] });
  };

  const callIn = useMutation({
    mutationFn: (entryId: string) => callInEntry(accessToken ?? "", entryId),
    onSuccess: refresh,
  });
  const seat = useMutation({
    mutationFn: ({ entryId, staffUserId }: { entryId: string; staffUserId: string }) =>
      seatEntry(accessToken ?? "", entryId, staffUserId),
    onSuccess: async () => {
      setSeatTarget(null);
      await invalidateEverything();
    },
  });
  const complete = useMutation({
    mutationFn: (entryId: string) => completeEntry(accessToken ?? "", entryId),
    onSuccess: invalidateEverything,
  });
  const noShow = useMutation({
    mutationFn: (entryId: string) => noShowEntry(accessToken ?? "", entryId),
    onSuccess: invalidateEverything,
  });
  const cancel = useMutation({
    mutationFn: (entryId: string) => cancelWaitlistEntry(accessToken ?? "", entryId),
    onSuccess: refresh,
  });
  const add = useMutation({
    mutationFn: (input: Parameters<typeof addWalkIn>[1]) => addWalkIn(accessToken ?? "", input),
    onSuccess: async () => {
      setWalkInOpen(false);
      await refresh();
    },
  });

  const actionError =
    errorMessage(callIn.error) ??
    errorMessage(complete.error) ??
    errorMessage(noShow.error) ??
    errorMessage(cancel.error);

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <h1 className="m-0 font-serif text-[26px] font-semibold text-tn-ink">Live Waitlist</h1>
          {locations.length > 1 && (
            <LocationFilterPopover
              locations={locations}
              value={selectedLocationId}
              onChange={setChosenLocationId}
              label="Filter by location"
              includeAllOption={false}
            />
          )}
        </div>
        <div className="flex items-center gap-3.5">
          <SegmentedControl
            value={view}
            onChange={changeView}
            options={[
              { value: "list", label: "List" },
              { value: "board", label: "Board" },
            ]}
          />
          <div className="flex items-center gap-2 rounded-full bg-tn-success-bg px-3.5 py-2">
            <span className="h-2 w-2 rounded-full bg-tn-success" />
            <span className="font-sans text-xs font-semibold text-tn-success">
              {board?.waitingCount ?? 0} waiting
            </span>
          </div>
          <Button onClick={() => setWalkInOpen(true)} disabled={!selectedLocationId}>
            + Add Walk-in
          </Button>
        </div>
      </div>

      {actionError ? (
        <p
          role="alert"
          className="m-0 rounded-xl border border-tn-danger bg-tn-danger-bg px-4 py-3 font-sans text-[13px] text-tn-danger"
        >
          {actionError}
        </p>
      ) : null}

      {locationsQuery.isSuccess && locations.length === 0 ? (
        /*
         * A staff member on no roster reaches nothing — callerLocationIds
         * returns an empty list and every scoped read refuses. Without
         * this the page sits on its loading skeleton for good, because
         * the board query is disabled and so never resolves.
         */
        <div className="rounded-2xl border border-dashed border-tn-border px-5 py-12 text-center">
          <p className="m-0 font-sans text-[15px] font-semibold text-tn-ink">
            You&rsquo;re not assigned to a location yet
          </p>
          <p className="m-0 mt-2 font-sans text-[13px] text-tn-muted-5">
            The waitlist is per shop, so there&rsquo;s no queue to show until an owner adds you to
            one.
          </p>
        </div>
      ) : boardQuery.isPending ? (
        <BoardSkeleton />
      ) : boardQuery.isError ? (
        <div className="rounded-2xl border border-tn-danger bg-tn-danger-bg px-5 py-8 text-center">
          <p className="m-0 font-sans text-sm text-tn-danger">
            {errorMessage(boardQuery.error) ?? "Couldn't load the waitlist."}
          </p>
          <Button variant="secondary" className="mt-3" onClick={() => void boardQuery.refetch()}>
            Try again
          </Button>
        </div>
      ) : !board ? null : (
        /*
         * `key` on the view is what replays the animation: React swaps
         * the subtree, and an animation plays from its own `from` value
         * the moment an element is inserted. A CSS transition would need
         * the browser to have painted a "before" state that never exists
         * here.
         */
        <div
          key={view}
          className={`flex flex-col gap-7 ${
            viewDirection === "forward" ? "tn-view-in-forward" : "tn-view-in-back"
          }`}
        >
          {view === "list" ? (
            <ListView
              board={board}
              onCallIn={(entryId) => callIn.mutate(entryId)}
              onSeat={setSeatTarget}
              onComplete={(entryId) => complete.mutate(entryId)}
              onNoShow={(entryId) => noShow.mutate(entryId)}
              onCancel={(entryId) => cancel.mutate(entryId)}
              busyEntryId={
                callIn.isPending
                  ? callIn.variables
                  : complete.isPending
                    ? complete.variables
                    : noShow.isPending
                      ? noShow.variables
                      : cancel.isPending
                        ? cancel.variables
                        : null
              }
            />
          ) : (
            <BoardView board={board} onSeat={setSeatTarget} />
          )}
        </div>
      )}

      <AddWalkInModal
        open={walkInOpen}
        onClose={() => setWalkInOpen(false)}
        locationId={selectedLocationId}
        board={board}
        pending={add.isPending}
        error={errorMessage(add.error)}
        onSubmit={(input) => add.mutate({ locationId: selectedLocationId, ...input })}
      />

      <SeatChairModal
        entry={seatTarget}
        chairs={board?.chairs ?? []}
        onClose={() => setSeatTarget(null)}
        onSeat={(staffUserId) =>
          seatTarget && seat.mutate({ entryId: seatTarget.entryId, staffUserId })
        }
        pending={seat.isPending}
        error={errorMessage(seat.error)}
      />
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex flex-col gap-7">
      <div className="h-[120px] animate-pulse rounded-2xl bg-tn-neutral-bg" />
      <div className="h-[200px] animate-pulse rounded-2xl bg-tn-neutral-bg" />
    </div>
  );
}

interface ListViewProps {
  board: WaitlistBoard;
  onCallIn: (entryId: string) => void;
  onSeat: (entry: WaitingEntry) => void;
  onComplete: (entryId: string) => void;
  onNoShow: (entryId: string) => void;
  onCancel: (entryId: string) => void;
  busyEntryId: string | null | undefined;
}

function ListView({
  board,
  onCallIn,
  onSeat,
  onComplete,
  onNoShow,
  onCancel,
  busyEntryId,
}: ListViewProps) {
  return (
    <>
      <div>
        <p className="m-0 mb-3 font-sans text-[13px] font-semibold tracking-[0.02em] text-tn-muted-1">
          NOW SERVING
        </p>
        {board.nowServing.length === 0 ? (
          <EmptyPanel>Nobody's in a chair right now.</EmptyPanel>
        ) : (
          <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border">
            {board.nowServing.map((entry, index) => {
              const time = chairTimeLabel(entry.minutesLeft);
              return (
                <div
                  key={entry.entryId}
                  className={`flex flex-wrap items-center gap-4 px-[18px] py-3.5 ${
                    index < board.nowServing.length - 1 ? "border-b border-tn-border-soft" : ""
                  }`}
                >
                  <Avatar
                    initials={initialsOf(entry.staffName ?? entry.customerName)}
                    color={staffAvatarColorStrong(entry.staffUserId ?? entry.entryId)}
                  />
                  <div className="min-w-[180px] flex-1">
                    <p className="m-0 font-sans text-[13px] font-semibold text-tn-ink">
                      {entry.customerName} · {entry.serviceName}
                    </p>
                    <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">
                      With {entry.staffName ?? "—"}
                    </p>
                  </div>
                  <span
                    className={`font-sans text-xs font-semibold ${
                      time.over ? "text-tn-danger" : "text-tn-gold"
                    }`}
                  >
                    {time.text}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => onComplete(entry.entryId)}
                      disabled={busyEntryId === entry.entryId}
                    >
                      Complete
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onNoShow(entry.entryId)}
                      disabled={busyEntryId === entry.entryId}
                    >
                      No-show
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <p className="m-0 mb-3 font-sans text-[13px] font-semibold tracking-[0.02em] text-tn-muted-1">
          WAITING
        </p>
        {board.waiting.length === 0 ? (
          <EmptyPanel>
            Nobody's waiting. Anyone who joins from the app, a QR code or the button above lands
            here.
          </EmptyPanel>
        ) : (
          <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border">
            {board.waiting.map((entry, index) => (
              <div
                key={entry.entryId}
                className={`group flex flex-wrap items-center gap-4 px-[18px] py-3.5 ${
                  index < board.waiting.length - 1 ? "border-b border-tn-border-soft" : ""
                } ${index === 0 ? "bg-tn-detail-bg" : ""}`}
              >
                <span
                  className={`w-8 font-sans text-[13px] font-semibold ${
                    index === 0 ? "text-tn-gold" : "text-tn-muted-5"
                  }`}
                >
                  #{entry.position}
                </span>
                <div className="min-w-[180px] flex-1">
                  <p className="m-0 font-sans text-[13px] font-semibold text-tn-ink">
                    {entry.customerName} · {entry.serviceName}
                  </p>
                  <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">
                    Waiting {entry.waitingMinutes} min ·{" "}
                    {entry.staffName ? `Prefers ${entry.staffName.split(" ")[0]}` : "Any barber"}
                    {entry.status === "notified" ? " · Called in" : ""}
                    {entry.source !== "staff" ? " · Joined online" : ""}
                  </p>
                  {entry.notes ? (
                    <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-6">{entry.notes}</p>
                  ) : null}
                </div>

                <span className="font-sans text-xs text-tn-muted-5">
                  ~{entry.estimatedWaitMinutes} min
                </span>

                <div className="flex items-center gap-2">
                  {entry.status === "waiting" ? (
                    <Button
                      size="sm"
                      variant={index === 0 ? "primary" : "secondary"}
                      onClick={() => onCallIn(entry.entryId)}
                      disabled={busyEntryId === entry.entryId}
                    >
                      Call In
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => onSeat(entry)}>
                      Seat
                    </Button>
                  )}
                  {/*
                    Hidden until the row is hovered or focused on a
                    pointer device, always visible on touch: removing
                    somebody is destructive and shouldn't sit under a
                    thumb next to "Call In", but it also can't be
                    unreachable on the tablet most front desks use.
                  */}
                  <button
                    type="button"
                    onClick={() => onCancel(entry.entryId)}
                    disabled={busyEntryId === entry.entryId}
                    className="cursor-pointer border-none bg-transparent font-sans text-xs text-tn-muted-6 hover:text-tn-danger sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function BoardView({
  board,
  onSeat,
}: {
  board: WaitlistBoard;
  onSeat: (entry: WaitingEntry) => void;
}) {
  return (
    <>
      <div>
        <p className="m-0 mb-3 font-sans text-[13px] font-semibold tracking-[0.02em] text-tn-muted-1">
          CHAIRS — NOW SERVING
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {board.chairs.map((chair, index) => (
            <ChairCard key={chair.staffUserId} chair={chair} index={index} />
          ))}
        </div>
      </div>

      <div>
        <p className="m-0 mb-3 font-sans text-[13px] font-semibold tracking-[0.02em] text-tn-muted-1">
          UP NEXT
        </p>
        {board.waiting.length === 0 ? (
          <EmptyPanel>Nobody's waiting.</EmptyPanel>
        ) : (
          <div className="flex flex-wrap gap-7">
            {board.waiting.map((entry, index) => (
              <button
                key={entry.entryId}
                type="button"
                onClick={() => onSeat(entry)}
                className="flex w-[104px] cursor-pointer flex-col items-center gap-2 border-none bg-transparent text-center"
              >
                <span className="relative">
                  <span
                    className={`flex h-[68px] w-[68px] items-center justify-center rounded-full font-sans text-[15px] font-semibold ${
                      index === 0
                        ? "border-2 border-tn-gold bg-tn-gold-bg-soft text-tn-gold"
                        : "bg-tn-neutral-bg text-tn-muted-3"
                    }`}
                  >
                    {initialsOf(entry.customerName)}
                  </span>
                  <span className="absolute -top-1 -right-1 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-tn-dark font-sans text-[11px] font-semibold text-tn-on-dark">
                    {entry.position}
                  </span>
                </span>
                <span className="font-sans text-[13px] font-semibold text-tn-ink">
                  {entry.customerName}
                </span>
                <span className="-mt-1 font-sans text-xs text-tn-muted-5">{entry.serviceName}</span>
                <span className="font-sans text-xs font-semibold text-tn-gold">
                  {entry.status === "notified" ? "Called in" : `~${entry.estimatedWaitMinutes} min`}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function ChairCard({ chair, index }: { chair: WaitlistChair; index: number }) {
  const current = chair.current;
  const ringRef = useRef<SVGCircleElement>(null);
  /**
   * Whether this ring has already been drawn once.
   *
   * The board re-reads itself every fifteen seconds, and a ring that
   * restarted from empty on every poll would be a permanently
   * re-animating dial rather than a reading. So the grow-from-zero
   * happens on mount only; after that a changed value just transitions
   * from wherever it was, which for a fifteen-second tick is a
   * fraction of a degree nobody will notice.
   *
   * Switching to the Board view remounts these (the view wrapper is
   * keyed on `view`), which is exactly when the draw *should* replay.
   */
  const hasDrawn = useRef(false);
  const time = chairTimeLabel(current?.minutesLeft ?? null);

  /**
   * How far through the appointment we are, as a fraction of the ring.
   * Derived from what's left over the total rather than from elapsed
   * time, so an overrun simply fills the ring instead of wrapping past
   * the start and reading as "just begun".
   */
  const progress =
    current && current.durationMinutes > 0 && current.minutesLeft !== null
      ? Math.min(1, Math.max(0, 1 - current.minutesLeft / current.durationMinutes))
      : 0;

  useLayoutEffect(() => {
    const ring = ringRef.current;
    if (!ring) return;
    const target = String(RING_CIRCUMFERENCE * (1 - progress));

    if (hasDrawn.current || prefersReducedMotion()) {
      ring.style.strokeDashoffset = target;
      hasDrawn.current = true;
      return;
    }

    // Empty first, committed and painted, and only then the transition
    // and the real value — see .tn-ring-draw in index.css.
    ring.style.strokeDashoffset = String(RING_CIRCUMFERENCE);
    hasDrawn.current = true;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        ring.classList.add("tn-ring-draw");
        ring.style.strokeDashoffset = target;
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [progress]);

  if (!current) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-tn-border px-5 py-8">
        <span className="flex h-[104px] w-[104px] items-center justify-center rounded-full bg-tn-page">
          <span className="h-4 w-4 rounded-full border-2 border-tn-faint-2" />
        </span>
        <p className="m-0 font-sans text-[15px] font-semibold text-tn-muted-5">{chair.name}</p>
        <p className="m-0 font-sans text-[13px] text-tn-muted-6">Open — ready for next</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-tn-border px-5 py-8">
      <span className="relative flex h-[104px] w-[104px] items-center justify-center">
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full -rotate-90"
          aria-hidden
        >
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="var(--color-tn-border-soft)"
            strokeWidth="7"
          />
          <circle
            ref={ringRef}
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke={time.over ? "var(--color-tn-danger)" : "var(--color-tn-gold)"}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            /*
             * Starts empty in the markup so there is no frame of a full
             * ring before the effect above runs — the effect sets the
             * real value, and on first mount animates to it.
             */
            strokeDashoffset={RING_CIRCUMFERENCE}
            // A short stagger across the row, so the chairs read as a set
            // filling in rather than one simultaneous flash.
            style={{ transitionDelay: `${Math.min(index, 6) * 180}ms` }}
          />
        </svg>
        <Avatar
          initials={chair.initials}
          color={staffAvatarColorStrong(chair.staffUserId)}
          size={80}
        />
      </span>
      <p className="m-0 font-sans text-[15px] font-semibold text-tn-ink">{chair.name}</p>
      <p className="m-0 font-sans text-[13px] text-tn-muted-5">with {current.customerName}</p>
      <span className="rounded-lg bg-tn-page px-3 py-1.5 font-sans text-xs text-tn-muted-3">
        {current.serviceName}
      </span>
      <p
        className={`m-0 font-sans text-[13px] font-semibold ${
          time.over ? "text-tn-danger" : "text-tn-gold"
        }`}
      >
        {time.text}
      </p>
    </div>
  );
}

function EmptyPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-tn-border px-5 py-10 text-center font-sans text-[13px] text-tn-muted-5">
      {children}
    </div>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
}

export default WaitlistPage;
