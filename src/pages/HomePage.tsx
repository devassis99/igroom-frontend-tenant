import { Button } from "@/components/ui/Button";
import { LaunchChecklistCard } from "@/components/dashboard/LaunchChecklistCard";
import { useAuthStore } from "@/auth/auth-store";

/**
 * The shop owner's landing page after login — greeting + "+ Add Booking"
 * plus the "Getting Started" onboarding checklist (LaunchChecklistCard).
 * Split off from what the mockup's single T6 Owner Dashboard frame drew
 * as one page: the stat tiles/schedule/by-location breakdown that used to
 * live here moved to their own Analytics page (see AnalyticsPage.tsx) —
 * this one stays focused on "welcome back, here's what to do next"
 * (onboarding progress today, room for announcements/how-to content
 * later) rather than reporting.
 */
export function HomePage() {
  const owner = useAuthStore((s) => s.owner);
  const firstName = owner?.fullName?.split(" ")[0] ?? "there";

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-center justify-between">
        <h1 className="m-0 font-serif text-[26px] font-semibold text-tn-ink">
          Good morning, {firstName}
        </h1>
        <Button>+ Add Booking</Button>
      </div>

      <LaunchChecklistCard />
    </div>
  );
}

export default HomePage;
