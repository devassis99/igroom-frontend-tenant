import { INTEGRATIONS, LOCATIONS, SERVICES, STAFF, TODAY_SCHEDULE } from "./sample-data";
import { t } from "@/i18n";

export interface LaunchChecklistStep {
  id: string;
  title: string;
  description: string;
  done: boolean;
  ctaLabel: string;
  ctaTo: string;
}

/**
 * Dashboard's "Getting Started" checklist (the Home-page onboarding card
 * every shop owner sees until they've finished setting up). Unlike most of
 * this app's sample-data-driven screens, every `done` flag here is a real
 * derivation over the shared SAMPLE_* arrays rather than a hardcoded true —
 * the same "real interaction, illustrative data" split the rest of the app
 * follows (see sample-data.ts's header comment). Once igroom-backend grows
 * tenant-scoped services/staff/locations/bookings endpoints, these are
 * exactly the booleans a real GET /dashboard/onboarding-status (or
 * equivalent) response would carry — swap the SAMPLE_* reads below for that
 * response and keep the shape.
 */
export function getLaunchChecklistSteps(): LaunchChecklistStep[] {
  return [
    {
      id: "services",
      title: t("Add your services"),
      description: t(
        "List what you offer so clients can book online — haircuts, beard trims, combos, whatever your chairs handle.",
      ),
      done: SERVICES.some((s) => s.status === "Enabled"),
      ctaLabel: t("Go to Services"),
      ctaTo: "/services",
    },
    {
      id: "staff",
      title: t("Add your team"),
      description: t(
        "Invite the barbers and staff who take bookings, so clients can pick who they want when they book.",
      ),
      done: STAFF.length > 1,
      ctaLabel: t("Go to Staff"),
      ctaTo: "/staff",
    },
    {
      id: "locations",
      title: t("Set your hours & locations"),
      description: t(
        "Confirm your shop's hours and locations so the booking calendar only ever offers real openings.",
      ),
      done: LOCATIONS.some((l) => l.status === "Active"),
      ctaLabel: t("Go to Locations"),
      ctaTo: "/locations",
    },
    {
      id: "payments",
      title: t("Turn on payments"),
      description: t(
        "Connect Stripe so clients can pay — or leave a deposit — right when they book.",
      ),
      done: INTEGRATIONS.find((i) => i.id === "stripe")?.connected ?? false,
      ctaLabel: t("Go to Integrations"),
      ctaTo: "/integrations",
    },
    {
      id: "reminders",
      title: t("Connect reminders"),
      description: t(
        "Turn on SMS or WhatsApp so clients get automatic confirmations and no-show reminders.",
      ),
      done: INTEGRATIONS.some((i) => (i.id === "sms" || i.id === "whatsapp") && i.connected),
      ctaLabel: t("Go to Integrations"),
      ctaTo: "/integrations",
    },
    {
      id: "booking",
      title: t("Take your first booking"),
      description: t("Once a booking lands on your calendar, your shop is officially live."),
      done: TODAY_SCHEDULE.length > 0,
      ctaLabel: t("Go to Calendar"),
      ctaTo: "/calendar",
    },
  ];
}
