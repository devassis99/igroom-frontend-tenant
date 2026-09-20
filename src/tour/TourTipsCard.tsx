import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { useTour } from "./TourProvider";
import { useTourStore } from "./tour-store";

/**
 * The settings side of the walkthroughs, for the profile screen.
 *
 * Two controls, and the difference between them matters: the switch
 * stops tours *opening on their own*, and the button makes every screen
 * offer its own again from scratch. Neither removes the sidebar's help
 * button, so switching tips off is never a decision somebody has to
 * undo before they can get an explanation back.
 *
 * Worth saying out loud on screen, because this is a shared machine as
 * often as not: the setting lives in this browser, not on the account.
 * Turning it off at the front desk doesn't turn it off for the owner at
 * home, and a new starter on the desk's own login still gets the tours.
 */
export function TourTipsCard() {
  const autoplay = useTourStore((state) => state.autoplay);
  const setAutoplay = useTourStore((state) => state.setAutoplay);
  const resetSeen = useTourStore((state) => state.resetSeen);
  const { startTour } = useTour();

  return (
    <section
      data-tour="settings-tips"
      className="flex flex-col gap-3 border-t border-tn-border-soft pt-6"
    >
      <p className="m-0 font-sans text-sm font-semibold text-tn-ink">Screen tips</p>
      <p className="m-0 -mt-1 font-sans text-xs text-tn-muted-5">
        A short walkthrough the first time someone opens a screen. This is remembered in this
        browser, so turning it off here doesn&rsquo;t turn it off for the rest of your team.
      </p>
      <Toggle checked={autoplay} onChange={setAutoplay} label="Show tips on a screen's first use" />
      <Button
        variant="secondary"
        size="sm"
        className="w-fit"
        onClick={() => {
          // Reset, then immediately run this screen's own tour: without
          // that, "Show all tips again" looks like it did nothing until
          // you happen to visit a screen you have already seen.
          resetSeen();
          startTour();
        }}
      >
        Show all tips again
      </Button>
    </section>
  );
}
