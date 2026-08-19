import { LaunchChecklistCard } from "@/components/dashboard/LaunchChecklistCard";
import { ResourcesSupportSection } from "@/components/dashboard/ResourcesSupportSection";

/**
 * The shop owner's landing page after login — the "Getting Started"
 * onboarding checklist (LaunchChecklistCard) plus Resources & Support.
 * Split off from what the mockup's single T6 Owner Dashboard frame drew
 * as one page: the stat tiles/schedule/by-location breakdown that used to
 * live here moved to their own Analytics page (see AnalyticsPage.tsx) —
 * this one stays focused on "here's what to do next" (onboarding progress
 * today, room for announcements/how-to content later) rather than
 * reporting. Previously also had a "Good morning, {name}" greeting and a
 * dead "+ Add Booking" button in the header — both dropped per request.
 */
export function HomePage() {
  return (
    <div className="flex flex-col gap-7">
      <LaunchChecklistCard />

      <ResourcesSupportSection />
    </div>
  );
}

export default HomePage;
