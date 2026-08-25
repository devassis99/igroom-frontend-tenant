import { useLayoutEffect, useState, type RefObject } from "react";

/** Gap between a trigger and the panel hanging off it. */
export const ANCHOR_GAP = 6;
/** How close a panel is allowed to get to the edge of the viewport. */
const VIEWPORT_MARGIN = 12;

export interface AnchoredPanelPosition {
  left: number;
  /** Set when the panel hangs below the trigger. */
  top?: number;
  /** Set instead of `top` when the panel was flipped above the trigger — distance from the viewport's bottom edge. */
  bottom?: number;
  width: number;
  /** How tall the panel may grow before it would leave the viewport. Apply it, and let the panel's own scroll area take the overflow. */
  maxHeight: number;
  placement: "below" | "above";
}

export interface AnchoredPanelOptions {
  /** A fixed pixel width, or "anchor" to match the trigger's own width. */
  width: number | "anchor";
  /** Floor for an "anchor" width, so a narrow trigger doesn't produce an unreadable panel. */
  minWidth?: number;
  /**
   * The smallest useful panel. If less than this fits below the trigger
   * and more room exists above, the panel flips up instead of being
   * squashed into a sliver.
   */
  minHeight?: number;
}

/**
 * Positions a portaled `position: fixed` popover against its trigger.
 *
 * Every picker in this folder used to carry its own four-line copy of
 * this: read the trigger's rect, pin the panel to `rect.bottom`, done.
 * That reads fine mid-page and breaks at the edges — the timezone field
 * near the bottom of the Locations detail form opened a ~400px panel into
 * ~120px of remaining viewport, so all you saw was its header with the
 * list clipped off below the fold, and nothing scrolled it back into view
 * because a fixed panel doesn't move with the page.
 *
 * So this does the three things those copies didn't: flips the panel above
 * the trigger when there isn't room below, hands back a `maxHeight` so the
 * panel's own scroll area absorbs whatever is left over, and clamps
 * horizontally so a right-aligned trigger doesn't push the panel off-screen.
 * It also recomputes on scroll (capture-phase, so scrolling *containers*
 * count, not just the window) rather than letting the panel drift away
 * from the field it belongs to.
 *
 * `active` should stay true through any closing animation — see
 * TimePicker's `mounted` state — so a panel doesn't lose its position
 * mid-animation.
 */
export function useAnchoredPanel(
  active: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  options: AnchoredPanelOptions,
): AnchoredPanelPosition | null {
  const { width, minWidth = 0, minHeight = 200 } = options;
  const [position, setPosition] = useState<AnchoredPanelPosition | null>(null);

  useLayoutEffect(() => {
    if (!active || !anchorRef.current) {
      setPosition(null);
      return;
    }

    function measure() {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();

      const panelWidth =
        width === "anchor" ? Math.max(rect.width, minWidth) : Math.max(width, minWidth);

      const spaceBelow = window.innerHeight - rect.bottom - ANCHOR_GAP - VIEWPORT_MARGIN;
      const spaceAbove = rect.top - ANCHOR_GAP - VIEWPORT_MARGIN;
      // Only flip when it actually helps: cramped below *and* roomier above.
      const flip = spaceBelow < minHeight && spaceAbove > spaceBelow;

      // Prefer the trigger's left edge, but never past either side of the
      // viewport. Math.max last so a viewport narrower than the panel
      // still starts at the left margin rather than a negative offset.
      const left = Math.max(
        VIEWPORT_MARGIN,
        Math.min(rect.left, window.innerWidth - panelWidth - VIEWPORT_MARGIN),
      );

      setPosition(
        flip
          ? {
              left,
              bottom: window.innerHeight - rect.top + ANCHOR_GAP,
              width: panelWidth,
              maxHeight: Math.max(spaceAbove, 0),
              placement: "above",
            }
          : {
              left,
              top: rect.bottom + ANCHOR_GAP,
              width: panelWidth,
              maxHeight: Math.max(spaceBelow, 0),
              placement: "below",
            },
      );
    }

    measure();
    // Capture phase: a scroll inside the Locations detail pane (or any
    // other overflow container) never bubbles to window, so a bubbling
    // listener would miss exactly the case this exists for.
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [active, anchorRef, width, minWidth, minHeight]);

  return position;
}
