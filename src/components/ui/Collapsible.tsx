import { useEffect, useState, type ReactNode } from "react";

/**
 * A box that opens and closes to whatever height its contents turn out
 * to need.
 *
 * Two things make this worth having rather than rendering the content
 * conditionally:
 *
 * The height. Nothing here measures anything — the 0fr → 1fr grid row in
 * .tn-collapsible animates to the content's own height, so a two-line
 * panel and a chart-and-two-buttons panel both open correctly without a
 * max-height guessed in advance (which either clips the long one or
 * makes the short one spend most of the animation empty).
 *
 * The first frame. A transition has nothing to animate from if the
 * element is *born* open, which is what happens to anything rendered the
 * moment it has something to say: it pops. So the first paint after
 * mounting is always closed and the open state arrives on the next
 * frame, which is what the transition needs to run at all.
 *
 * Closing has one requirement of the caller: keep passing the content.
 * A panel whose data has just been deleted must still be handed the old
 * data while it closes, or what closes is an empty box (see useRetained).
 */
export function Collapsible({
  open,
  className = "",
  children,
}: {
  open: boolean;
  /** Applied to the content wrapper — padding and layout for the thing inside. */
  className?: string;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const isOpen = open && mounted;

  return (
    <div
      className="tn-collapsible"
      data-open={isOpen}
      aria-hidden={!isOpen}
      // Closed, it is still in the page at zero height. Without this its
      // buttons stay in the tab order, and somebody on a keyboard lands
      // on a fix for a clash that isn't there any more.
      inert={!isOpen}
    >
      <div className="overflow-hidden">
        {/* The fade and lift are separate from the height so the contents
            arrive whole rather than being stretched open. */}
        <div
          className={`transition-[opacity,transform] duration-200 ease-out ${
            isOpen ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
          } ${className}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default Collapsible;
