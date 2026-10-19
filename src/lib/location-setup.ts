import type { AccountLocation, LocationSetupStep } from "./locations-api";

/**
 * The four things a branch needs before its booking link is worth
 * handing out — the backend decides which are missing (locations'
 * `setupMissing`), this is how each one is explained and where it's
 * fixed. Same order as the backend's.
 */
export const LOCATION_SETUP_STEPS: readonly {
  step: LocationSetupStep;
  /** The tab on the location's page where it's fixed. */
  tab: "details" | "services" | "staff" | "availability";
  title: string;
  done: string;
  how: string;
  action: string;
  /** For "Needs timezone, services and working hours". */
  short: string;
}[] = [
  {
    step: "timezone",
    tab: "details",
    title: "Set the timezone",
    done: "Timezone set",
    how: "Pick it under TIMEZONE on this tab, then Save changes. Until then booking times are read in UTC, so customers would see slots at the wrong hour.",
    action: "Set timezone",
    short: "timezone",
  },
  {
    step: "services",
    tab: "services",
    title: "Offer a service here",
    done: "Services offered",
    how: "Tick at least one service in Services & pricing that isn't hidden from online booking. If the list is empty, add your services on the Services page first.",
    action: "Open Services & pricing",
    short: "services",
  },
  {
    step: "staff",
    tab: "staff",
    title: "Assign someone to work here",
    done: "Staff assigned",
    how: "Add at least one team member to this location in the Staff tab.",
    action: "Open Staff",
    short: "staff",
  },
  {
    step: "hours",
    tab: "availability",
    title: "Set working hours",
    done: "Working hours set",
    how: "Give at least one person here their weekly hours in the Availability tab.",
    action: "Open Availability",
    short: "working hours",
  },
];

/** "timezone, services and working hours" — what a row says is missing. */
export function setupSummary(location: Pick<AccountLocation, "setupMissing">): string {
  const parts = LOCATION_SETUP_STEPS.filter((s) => location.setupMissing.includes(s.step)).map(
    (s) => s.short,
  );
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
