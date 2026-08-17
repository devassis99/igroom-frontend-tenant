import { INTEGRATIONS, LOCATIONS, SERVICES, STAFF, TODAY_SCHEDULE } from "./sample-data";

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
      title: "Add your services",
      description:
        "List what you offer so clients can book online — haircuts, beard trims, combos, whatever your chairs handle.",
      done: SERVICES.some((s) => s.status === "Enabled"),
      ctaLabel: "Go to Services",
      ctaTo: "/services",
    },
    {
      id: "staff",
      title: "Add your team",
      description:
        "Invite the barbers and staff who take bookings, so clients can pick who they want when they book.",
      done: STAFF.length > 1,
      ctaLabel: "Go to Staff",
      ctaTo: "/staff",
    },
    {
      id: "locations",
      title: "Set your hours & locations",
      description:
        "Confirm your shop's hours and locations so the booking calendar only ever offers real openings.",
      done: LOCATIONS.some((l) => l.status === "Active"),
      ctaLabel: "Go to Locations",
      ctaTo: "/settings/locations",
    },
    {
      id: "payments",
      title: "Turn on payments",
      description: "Connect Stripe so clients can pay — or leave a deposit — right when they book.",
      done: INTEGRATIONS.find((i) => i.id === "stripe")?.connected ?? false,
      ctaLabel: "Go to Integrations",
      ctaTo: "/integrations",
    },
    {
      id: "reminders",
      title: "Connect reminders",
      description:
        "Turn on SMS or WhatsApp so clients get automatic confirmations and no-show reminders.",
      done: INTEGRATIONS.some((i) => (i.id === "sms" || i.id === "whatsapp") && i.connected),
      ctaLabel: "Go to Integrations",
      ctaTo: "/integrations",
    },
    {
      id: "booking",
      title: "Take your first booking",
      description: "Once a booking lands on your calendar, your shop is officially live.",
      done: TODAY_SCHEDULE.length > 0,
      ctaLabel: "Go to Calendar",
      ctaTo: "/calendar",
    },
  ];
}
