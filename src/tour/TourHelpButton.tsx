import { useTour } from "./TourProvider";

/**
 * The sidebar's "Page tips" row — the way back to a screen's
 * walkthrough once it has been skipped, finished, or switched off.
 *
 * Styled as a sibling of What's New rather than as an icon button
 * floating over the content: this app's chrome is the sidebar, and a
 * help control that lives anywhere else is one people look for in the
 * sidebar anyway.
 *
 * It renders nothing on a screen with no tour, rather than sitting there
 * disabled. A help button that does nothing when pressed teaches people
 * that help doesn't work here, which is worse than there being none on
 * the two or three screens that have none.
 *
 * `collapsed` is passed rather than read from a context: the sidebar
 * owns that state, and a context for one boolean shared with one child
 * would be indirection for its own sake. The label collapses the same
 * way its neighbours do — opacity and max-width, in step with the
 * `<aside>`'s own width transition — instead of unmounting, which would
 * pop rather than fade.
 */
export function TourHelpButton({ collapsed }: { collapsed: boolean }) {
  const { tour, isActive, startTour } = useTour();

  if (!tour) return null;

  return (
    <button
      type="button"
      data-tour="nav-help"
      onClick={startTour}
      // Named for what it does here rather than "Help": on the calendar
      // this reopens the calendar's walkthrough, and the label should say
      // so to somebody who cannot see which screen they are on.
      aria-label={`Show tips for ${tour.title.toLowerCase()}`}
      title={collapsed ? "Page tips" : undefined}
      className="flex cursor-pointer items-center gap-2.5 border-none bg-transparent px-6 pb-4 text-left"
    >
      <span
        aria-hidden
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border font-sans text-[11px] font-semibold ${
          isActive
            ? "border-tn-gold bg-tn-gold-bg text-tn-gold"
            : "border-tn-input-border text-tn-muted-5"
        }`}
      >
        ?
      </span>
      <div
        className={`overflow-hidden font-sans text-[13px] font-medium whitespace-nowrap text-tn-nav-inactive transition-[opacity,max-width] duration-200 ease-in-out ${
          collapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100"
        }`}
      >
        Page tips
      </div>
    </button>
  );
}
