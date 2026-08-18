import { request } from "./http";

/**
 * Talks to igroom-backend's /bookings module (see bookings.service.ts).
 * Every route requires a bearer token — requireAccountAuth derives
 * accountId/locationId from the token server-side. locationId is
 * optional on both GET calls below: omit it to get the caller's own
 * location (unchanged default), or pass one of locations-api.ts's
 * AccountLocation ids to view a different one of the account's locations
 * — see CalendarPage.tsx's location dropdown.
 */

export type BookingStatus = "confirmed" | "walk_in" | "cancelled" | "completed";

export interface Booking {
  id: string;
  locationId: string;
  staffUserId: string;
  staffName: string;
  customerName: string;
  customerPhone: string | null;
  serviceName: string;
  durationMinutes: number;
  priceCents: number | null;
  /** ISO 8601 */
  startAt: string;
  /** ISO 8601 */
  endAt: string;
  status: BookingStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BookingsStaffMember {
  id: string;
  name: string;
  role: string;
}

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

/** Active staff at a location (defaults to the caller's own) — backs the Day view's columns and the Add Booking "assign to" picker. */
export function listStaff(
  accessToken: string,
  locationId?: string,
): Promise<{ staff: BookingsStaffMember[] }> {
  const params = locationId ? `?${new URLSearchParams({ locationId }).toString()}` : "";
  return request(`/bookings/staff${params}`, { headers: authHeaders(accessToken) });
}

export interface ListBookingsRange {
  /** ISO 8601, inclusive */
  start: string;
  /** ISO 8601, exclusive */
  end: string;
}

/** Every non-cancelled booking overlapping [start, end) at a location (defaults to the caller's own) — pass whatever range the visible Day/Week/Month grid needs. */
export function listBookings(
  accessToken: string,
  range: ListBookingsRange,
  locationId?: string,
): Promise<{ bookings: Booking[] }> {
  const params = new URLSearchParams({ start: range.start, end: range.end });
  if (locationId) params.set("locationId", locationId);
  return request(`/bookings?${params.toString()}`, { headers: authHeaders(accessToken) });
}

export interface CreateBookingPayload {
  staffUserId: string;
  customerName: string;
  customerPhone?: string;
  serviceName: string;
  durationMinutes: number;
  priceCents?: number;
  /** ISO 8601 */
  startAt: string;
  status?: "confirmed" | "walk_in";
  notes?: string;
}

export function createBooking(
  accessToken: string,
  payload: CreateBookingPayload,
): Promise<Booking> {
  return request("/bookings", { method: "POST", body: payload, headers: authHeaders(accessToken) });
}

export interface UpdateBookingPayload {
  staffUserId?: string;
  customerName?: string;
  customerPhone?: string;
  serviceName?: string;
  durationMinutes?: number;
  priceCents?: number;
  /** ISO 8601 */
  startAt?: string;
  status?: "confirmed" | "walk_in" | "completed";
  notes?: string;
}

/** Powers both a plain edit and a reschedule (T7d) — reschedule just sends startAt (and maybe staffUserId). */
export function updateBooking(
  accessToken: string,
  bookingId: string,
  payload: UpdateBookingPayload,
): Promise<Booking> {
  return request(`/bookings/${bookingId}`, {
    method: "PATCH",
    body: payload,
    headers: authHeaders(accessToken),
  });
}

/** T7e Cancel Appointment — a soft status flip server-side, not a delete. */
export function cancelBooking(accessToken: string, bookingId: string): Promise<Booking> {
  return request(`/bookings/${bookingId}/cancel`, {
    method: "POST",
    headers: authHeaders(accessToken),
  });
}
