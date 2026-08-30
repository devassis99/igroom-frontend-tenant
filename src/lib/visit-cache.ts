import type { QueryClient } from "@tanstack/react-query";

/**
 * One visit, three caches.
 *
 * A seated walk-in exists as a queue row *and* a booking, and the
 * backend keeps the two in step in both directions — completing on
 * either side closes the other (shared/waitlist.ts's
 * closeEntryForBooking). Which means every write that ends a visit
 * invalidates all three reads, whichever screen it was made from:
 * the calendar grid ("bookings"), the calendar's list view
 * ("bookings-list") and the Live Waitlist board ("waitlist").
 *
 * A helper rather than three calls at each site because the omission is
 * silent: forget "waitlist" in a calendar handler and the queue keeps
 * showing somebody who left, for up to the fifteen seconds until its
 * poll comes round — long enough that a busy desk clicks Complete on a
 * row that is already finished.
 */
export function invalidateVisitCaches(queryClient: QueryClient): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["bookings"] }),
    queryClient.invalidateQueries({ queryKey: ["bookings-list"] }),
    queryClient.invalidateQueries({ queryKey: ["waitlist"] }),
  ]).then(() => undefined);
}
