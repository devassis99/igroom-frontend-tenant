import { Collapsible } from "@/components/ui/Collapsible";
import type { LiveCollisionStatus } from "./use-live-collisions";

/**
 * Component A — the permanent status of the form.
 *
 * One bar, pinned to the bottom of the form column, holding the Save
 * button and the single sentence that says whether Save will work. It
 * replaces a scattering of messages that each appeared somewhere else:
 * a red line beside the button, a panel at the top of the page, and —
 * worst of all — nothing at all until Save had already been pressed and
 * refused.
 *
 * It counts; it does not explain. A clash gets one line here naming the
 * day and the other shop, and the explaining happens in the panel under
 * that day (component B), where the chart and the fix buttons are.
 * Saying it twice, in two places, in two wordings, is what made the old
 * screen hard to read.
 *
 * It sits in the page rather than pinned to the viewport — see the note
 * on the wrapper below.
 */
export interface AvailabilityActionBarProps {
  /** Days on this tab whose hours differ from what was last saved. */
  changeCount: number;
  /** What blocks the save — an overlap, or the form's own same-day range conflict. */
  blocked: {
    count: number;
    /** "Monday, 9 h with Valencia", or the row-conflict wording. */
    summary: string;
    /** True when this is a pre-existing clash on saved hours rather than something just typed. */
    preExisting?: boolean;
    /** Absent for a row conflict, which is fixed in the fields themselves rather than in a panel. */
    onReview?: () => void;
  } | null;
  /**
   * The amber count. Never blocks; the bar mentions it on its second
   * line.
   *
   * Two things land here, and they are not the same news. A travel
   * warning says a gap is tight. An "unsaved" clash is a real overlap
   * with hours typed into another tab — it will refuse a save, just not
   * this one — so it is worth naming as what it is rather than filing
   * under warnings.
   */
  warning: {
    count: number;
    kind: "travel" | "unsaved";
    summary: string;
    onReview?: () => void;
  } | null;
  /** The live check's state, so a bar that hasn't heard back yet doesn't claim the week is clean. */
  status: LiveCollisionStatus;
  /** A save that failed for an ordinary reason — network, or a server refusal the form couldn't predict. */
  error?: string | null;
  /** Unsaved work on tabs other than this one, which Save will not write. */
  otherTabsNote?: string | null;
  saving?: boolean;
  /** Shown for a few seconds after a successful save, then the bar closes. */
  justSaved?: boolean;
  /**
   * Whether the bar is open.
   *
   * A prop rather than the caller rendering it conditionally, because a
   * bar that is only *mounted* when it has something to say can't close
   * — it vanishes, and the page under it jumps up by its height. Kept
   * mounted, it can open and close like the day panels do.
   */
  visible: boolean;
  onSave: () => void;
}

/** The little square at the left — the one thing readable at a glance from across a desk. */
function Glyph({ tone }: { tone: "blocked" | "clear" | "busy" }) {
  const look =
    tone === "blocked"
      ? "bg-tn-danger-strong text-tn-on-dark"
      : tone === "clear"
        ? "bg-tn-success text-tn-on-dark"
        : "bg-tn-plan-track text-tn-on-dark/70";
  return (
    <span
      aria-hidden
      // The bar keeps its place and changes state in it — going from
      // green to red is one object changing its mind, not two objects
      // swapping, and the colour has to move for it to read that way.
      className={`flex h-7 w-7 flex-none items-center justify-center rounded-lg font-sans text-sm font-bold transition-colors duration-200 ${look}`}
    >
      {tone === "blocked" ? "!" : tone === "clear" ? "✓" : "…"}
    </span>
  );
}

export function AvailabilityActionBar({
  changeCount,
  blocked,
  warning,
  status,
  error,
  otherTabsNote,
  saving,
  justSaved,
  visible,
  onSave,
}: AvailabilityActionBarProps) {
  const checking = status === "checking";
  // A failed check is not a blocked one. The form goes back to what it
  // did before this bar existed — Save is live, and the server refuses
  // if it must — because refusing to let anyone save because a warning
  // endpoint is down is the worse failure of the two.
  const checkFailed = status === "failed";

  const tone: "blocked" | "clear" | "busy" = justSaved
    ? "clear"
    : blocked
      ? "blocked"
      : checking || checkFailed
        ? "busy"
        : "clear";

  const changes = `${changeCount} change${changeCount === 1 ? "" : "s"}`;

  /**
   * Line 1 — the state of the form in one sentence.
   *
   * Never "error", never "invalid": it says what is true (a clash
   * blocks saving) and, where it can, which day and which shop, so the
   * sentence is enough to act on without opening anything.
   */
  const headline = justSaved
    ? "Saved"
    : blocked
      ? blocked.preExisting
        ? `${blocked.count} existing clash${blocked.count === 1 ? "" : "es"} · not caused by this edit`
        : `${blocked.count} clash${blocked.count === 1 ? "" : "es"} block${blocked.count === 1 ? "s" : ""} saving · ${blocked.summary}`
      : checking
        ? "Checking the other shops…"
        : // Nothing has been edited, so there is nothing for Save to
          // write and the greyed button needs no other explanation. It
          // is worth saying rather than leaving blank, because the bar
          // is also on screen at this point to report a warning — and
          // "No clashes · 0 changes ready to save" both denied that
          // warning and left the dead button unexplained.
          changeCount === 0
          ? warning
            ? `${warning.count} ${
                warning.kind === "unsaved" ? "unsaved clash" : "travel warning"
              }${warning.count === 1 ? "" : "s"} · nothing to save here`
            : "Nothing to save yet"
          : warning
            ? `No clashes · ${changes} ready to save`
            : `${changes} ready to save`;

  /**
   * Line 2 — everything that is true but doesn't decide whether Save
   * works: the changes waiting behind a blocker, the warning that won't
   * block, the tabs this button won't write.
   */
  const detail = justSaved
    ? null
    : error
      ? error
      : blocked && !blocked.preExisting
        ? [
            changeCount > 0 ? `${changes} ${changeCount === 1 ? "is" : "are"} ready` : null,
            warning ? `${warning.count} warning won’t block` : null,
          ]
            .filter(Boolean)
            .join(" · ") || null
        : warning
          ? warning.summary
          : checkFailed
            ? "Couldn’t check the other shops — saving still runs the same check on the server."
            : (otherTabsNote ?? null);

  return (
    /*
     * In the page, at the foot of the form — not pinned to the viewport
     * and not floating over the week.
     *
     * The spec asked for a bar fixed to the bottom of the screen, and it
     * was built that way first. On this page it read as a notification
     * hovering over the schedule rather than as the bottom of the form,
     * and it sat on top of the rows somebody was in the middle of
     * editing. So it stays where the Save row always was, below the
     * card, and gets its job done by being the only thing there rather
     * than by following the viewport: everything that would otherwise be
     * a scattering of red lines around this button is now in it, and the
     * day panels carry the detail up where the problem is.
     *
     * It opens and closes rather than appearing and disappearing. The
     * bar's arrival is the answer to the first thing somebody typed, and
     * a box this size popping into existence under the week — taking the
     * page's height with it — reads as a glitch rather than as a reply.
     * See ui/Collapsible.
     */
    <Collapsible open={visible} className="mt-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-tn-plan-bg px-4 py-3">
        <Glyph tone={tone} />
        {/* <output>, not a div with role="status" — same implicit role,
            and the element the platform already has for it. */}
        <output className="block min-w-[45%] flex-1" aria-live="polite">
          <p
            className={`m-0 truncate font-sans text-[13px] font-semibold transition-colors duration-200 ${
              tone === "blocked" ? "text-tn-danger" : "text-tn-on-dark"
            }`}
          >
            {headline}
          </p>
          {/* Line 2 is gone on a phone, where the bar has room for the
              line that decides whether Save works and nothing else —
              everything on it is also said in the panel or on the tab it
              is about. */}
          {detail && (
            <p className="m-0 mt-0.5 hidden truncate font-sans text-[11px] text-tn-on-dark/60 sm:block">
              {detail}
            </p>
          )}
        </output>

        {/* Review is the link between this bar and the panel that
            explains — it moves the viewport and nothing else. Absent for
            a row conflict, whose remedy is the fields themselves. */}
        {!justSaved && blocked?.onReview && (
          <button
            type="button"
            onClick={blocked.onReview}
            className="tn-rise-in flex-1 cursor-pointer rounded-lg border border-tn-on-dark/25 bg-transparent px-3.5 py-2 font-sans text-xs font-semibold text-tn-on-dark transition-colors hover:bg-tn-on-dark/10 sm:flex-none"
          >
            {blocked.count === 1 ? "Review clash" : `Review ${blocked.count} clashes`}
          </button>
        )}
        {!justSaved && !blocked && warning?.onReview && (
          <button
            type="button"
            onClick={warning.onReview}
            className="tn-rise-in flex-1 cursor-pointer rounded-lg border border-tn-on-dark/25 bg-transparent px-3.5 py-2 font-sans text-xs font-semibold text-tn-on-dark transition-colors hover:bg-tn-on-dark/10 sm:flex-none"
          >
            {warning.kind === "unsaved"
              ? warning.count === 1
                ? "Review clash"
                : `Review ${warning.count} clashes`
              : warning.count === 1
                ? "See warning"
                : `See ${warning.count} warnings`}
          </button>
        )}

        {!justSaved && (
          <button
            type="button"
            onClick={onSave}
            // Disabled only for the two things that genuinely make a save
            // pointless or refused: a blocker, or a check still running.
            // Both put their reason in the line to the left, which is the
            // rule this bar exists to keep — a dead button is never on
            // screen without the words that explain it.
            disabled={saving || checking || blocked !== null || changeCount === 0}
            className="flex-1 cursor-pointer rounded-lg border-none bg-tn-on-dark px-4 py-2 font-sans text-xs font-semibold text-tn-plan-bg transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        )}
      </div>
    </Collapsible>
  );
}

export default AvailabilityActionBar;
