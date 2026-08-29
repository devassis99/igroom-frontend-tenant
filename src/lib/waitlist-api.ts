import { request } from "./http";

/**
 * Talks to igroom-backend's /waitlist module — the front desk's own view
 * of the walk-in queue (see waitlist.service.ts there).
 *
 * Its consumer-facing counterpart is /app/waitlist, which the customer's
 * phone reads. Both sit on the same table and share the same arithmetic
 * (the backend's shared/waitlist.ts), so the board on the wall and the
 * position on somebody's phone can never disagree — which matters,
 * because they are frequently three feet apart.
 *
 * locationId is required on the board read for the same reason it is on
 * every bookings call: a staff member works at several branches now, so
 * there is no single location to fall back to, and a queue read against
 * a guess is the wrong shop's queue.
 */

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

export type WaitlistStatus = "waiting" | "notified" | "seated" | "served" | "cancelled" | "no_show";

export interface NowServingEntry {
  entryId: string;
  bookingId: string | null;
  customerName: string;
  customerPhone: string | null;
  serviceName: string;
  durationMinutes: number;
  staffUserId: string | null;
  staffName: string | null;
  staffAvatarUrl: string | null;
  seatedAt: string | null;
  /** Negative once the appointment overruns — render that rather than clamping it. */
  minutesLeft: number | null;
}

export interface WaitingEntry {
  entryId: string;
  position: number;
  customerName: string;
  customerPhone: string | null;
  /** Set when they joined from the app or a QR code; null for a walk-in the desk typed in. */
  customerId: string | null;
  serviceId: string | null;
  serviceName: string;
  durationMinutes: number;
  /** The barber they asked for. Null means "any". */
  staffUserId: string | null;
  staffName: string | null;
  partySize: number;
  status: "waiting" | "notified";
  source: "app" | "public" | "staff";
  notes: string | null;
  waitingMinutes: number;
  estimatedWaitMinutes: number;
  quotedWaitMinutes: number | null;
  joinedAt: string;
  notifiedAt: string | null;
}

export interface WaitlistChair {
  staffUserId: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  displayTitle: string | null;
  isOpen: boolean;
  current: {
    entryId: string;
    customerName: string;
    serviceName: string;
    durationMinutes: number;
    seatedAt: string | null;
    minutesLeft: number | null;
  } | null;
}

export interface WaitlistBoard {
  locationId: string;
  shopName: string;
  waitingCount: number;
  servingCount: number;
  servingCapacity: number;
  /** What the desk would quote somebody walking in right now. */
  estimatedWaitMinutes: number;
  nowServing: NowServingEntry[];
  waiting: WaitingEntry[];
  chairs: WaitlistChair[];
}

/** One call backs both the List and Board views — see the backend's comment on why they aren't three. */
export function getWaitlistBoard(accessToken: string, locationId: string): Promise<WaitlistBoard> {
  return request(`/waitlist?locationId=${encodeURIComponent(locationId)}`, {
    headers: authHeaders(accessToken),
  });
}

export interface AddWalkInInput {
  locationId: string;
  customerName: string;
  customerPhone?: string;
  serviceId: string;
  /** Omit for "any available barber". */
  staffUserId?: string;
  partySize?: number;
  notes?: string;
}

export function addWalkIn(
  accessToken: string,
  input: AddWalkInInput,
): Promise<{ entryId: string; position: number; quotedWaitMinutes: number }> {
  return request("/waitlist", { method: "POST", body: input, headers: authHeaders(accessToken) });
}

export function callInEntry(
  accessToken: string,
  entryId: string,
): Promise<{ entryId: string; status: WaitlistStatus }> {
  return request(`/waitlist/${entryId}/call-in`, {
    method: "POST",
    headers: authHeaders(accessToken),
  });
}

/**
 * Seating creates a real booking — the visit lands on the calendar, in
 * the day's takings and in the customer's history, and earns a loyalty
 * stamp when it completes. The returned bookingId is also stored on the
 * entry.
 */
export function seatEntry(
  accessToken: string,
  entryId: string,
  staffUserId: string,
): Promise<{
  entryId: string;
  status: WaitlistStatus;
  bookingId: string;
  staffName: string;
  seatedAt: string;
}> {
  return request(`/waitlist/${entryId}/seat`, {
    method: "POST",
    body: { staffUserId },
    headers: authHeaders(accessToken),
  });
}

export function completeEntry(
  accessToken: string,
  entryId: string,
): Promise<{ entryId: string; status: WaitlistStatus; bookingId: string | null }> {
  return request(`/waitlist/${entryId}/complete`, {
    method: "POST",
    headers: authHeaders(accessToken),
  });
}

export function noShowEntry(
  accessToken: string,
  entryId: string,
): Promise<{ entryId: string; status: WaitlistStatus }> {
  return request(`/waitlist/${entryId}/no-show`, {
    method: "POST",
    headers: authHeaders(accessToken),
  });
}

export function cancelWaitlistEntry(
  accessToken: string,
  entryId: string,
): Promise<{ entryId: string; status: WaitlistStatus }> {
  return request(`/waitlist/${entryId}/cancel`, {
    method: "POST",
    headers: authHeaders(accessToken),
  });
}

export const waitlistKeys = {
  board: (locationId: string) => ["waitlist", locationId] as const,
};
