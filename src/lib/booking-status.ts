import type { Booking } from "./bookings-api";

/**
 * Single source of truth for how a booking status renders across the
 * Calendar — StatusPill tone/label (Appointment modal + List view rows),
 * the solid accent bar on List view rows, and the tinted block used by the
 * Day/Week grid's booking cards. Colors are lifted from the T-List mockup
 * screenshots (Confirmed = green, Walk-in/Completed = neutral gray,
 * Cancelled/No-show = red) rather than guessed, so all three surfaces read
 * as one status scheme instead of three independently-drifted ones.
 */
export const BOOKING_STATUS_TONE: Record<
  Booking["status"],
  { tone: "success" | "danger" | "neutral"; label: string }
> = {
  confirmed: { tone: "success", label: "Confirmed" },
  walk_in: { tone: "neutral", label: "Walk-in" },
  completed: { tone: "neutral", label: "Completed" },
  cancelled: { tone: "danger", label: "Cancelled" },
  no_show: { tone: "danger", label: "No-show" },
};

/** Solid color for the List view's per-row left accent bar. */
export const BOOKING_STATUS_BAR: Record<Booking["status"], string> = {
  confirmed: "bg-tn-success",
  walk_in: "bg-tn-faint",
  completed: "bg-tn-faint",
  cancelled: "bg-tn-danger",
  no_show: "bg-tn-danger",
};

/** Tinted background + left border for the Day/Week grid's booking cards. */
export const BOOKING_STATUS_BLOCK: Record<Booking["status"], string> = {
  confirmed: "bg-tn-success-bg border-l-[3px] border-tn-success",
  walk_in: "bg-tn-neutral-bg border-l-[3px] border-tn-faint",
  completed: "bg-tn-neutral-bg border-l-[3px] border-tn-faint",
  cancelled: "bg-tn-danger-bg border-l-[3px] border-tn-danger",
  no_show: "bg-tn-danger-bg border-l-[3px] border-tn-danger",
};
