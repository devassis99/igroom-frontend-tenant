import { request } from "./http";

/**
 * Talks to igroom-backend's /bookings module (see bookings.service.ts).
 * Every route requires a bearer token — requireAccountAuth derives
 * accountId from it server-side.
 *
 * locationId is *required* on every call here, reads and writes alike. It
 * used to be optional, defaulting server-side to the caller's own
 * location; a staff member works at many now (see the backend's
 * db/schema/staff-locations.ts), so there is no single location to fall
 * back to, and a booking written against a guess is a booking at the
 * wrong shop. CalendarPage already tracks the selected location for its
 * own dropdown, so it passes it.
 */

export type BookingStatus = "confirmed" | "walk_in" | "cancelled" | "completed" | "no_show";

export interface Booking {
  id: string;
  locationId: string;
  staffUserId: string;
  staffName: string;
  customerName: string;
  customerPhone: string | null;
  /** Purely so the List view's "Message client" action has a real mailto: target — no in-app messaging exists. */
  customerEmail: string | null;
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

/** Active staff at a location — backs the Day view's columns and the Add Booking "assign to" picker. */
export function listStaff(
  accessToken: string,
  locationId: string,
): Promise<{ staff: BookingsStaffMember[] }> {
  const params = new URLSearchParams({ locationId }).toString();
  return request(`/bookings/staff?${params}`, { headers: authHeaders(accessToken) });
}

export interface ListBookingsRange {
  /** ISO 8601, inclusive */
  start: string;
  /** ISO 8601, exclusive */
  end: string;
}

/** Every non-cancelled booking overlapping [start, end) at a location — pass whatever range the visible Day/Week/Month grid needs. */
export function listBookings(
  accessToken: string,
  range: ListBookingsRange,
  locationId: string,
): Promise<{ bookings: Booking[] }> {
  const params = new URLSearchParams({ start: range.start, end: range.end, locationId });
  return request(`/bookings?${params.toString()}`, { headers: authHeaders(accessToken) });
}

export interface PagedBookingsResponse {
  bookings: Booking[];
  totalCount: number;
  upcomingCount: number;
  pastCount: number;
  page: number;
  pageSize: number;
}

export interface ListBookingsPagedParams {
  tab: "upcoming" | "past";
  /** 1-indexed, defaults to 1 server-side. */
  page?: number;
  /** Defaults to 20 server-side, max 100. */
  pageSize?: number;
  locationId?: string;
}

/** Backs the T-List Upcoming/Past view — a paged, unbounded-range feed (every status, including cancelled/no_show) split by whether the appointment is still to come. Unlike listBookings above, this isn't tied to a visible Day/Week/Month date range. */
export function listBookingsPaged(
  accessToken: string,
  params: ListBookingsPagedParams,
): Promise<PagedBookingsResponse> {
  const query = new URLSearchParams({ tab: params.tab });
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.locationId) query.set("locationId", params.locationId);
  return request(`/bookings/list?${query.toString()}`, { headers: authHeaders(accessToken) });
}

export interface CreateBookingPayload {
  /** Which shop the appointment is at. Required — see this file's header. */
  locationId: string;
  staffUserId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  serviceName: string;
  durationMinutes: number;
  priceCents?: number;
  /** ISO 8601 */
  startAt: string;
  status?: "confirmed" | "walk_in";
  notes?: string;
  /** Set only after the owner has confirmed an out-of-hours slot — the server refuses one otherwise. Never bypasses the double-booking check. */
  allowOutsideShift?: boolean;
  /**
   * Book through a travel-buffer warning — the gap to this member's
   * booking at another shop is shorter than the account allows for
   * getting between them. Never overrides a genuine overlap, which comes
   * back as DOUBLE_BOOKED with no override at all. See
   * lib/collisions-api.ts.
   */
  allowTravelWarning?: boolean;
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
  customerEmail?: string;
  serviceName?: string;
  durationMinutes?: number;
  priceCents?: number;
  /** ISO 8601 */
  startAt?: string;
  status?: "confirmed" | "walk_in" | "completed" | "no_show";
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

// --- Day view staff sets ("Front room" / "Colour team" chips) ---

export interface StaffSet {
  id: string;
  locationId: string;
  name: string;
  staffUserIds: string[];
  isDefault: boolean;
  isShared: boolean;
  createdByStaffUserId: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Every set the caller can see at a location — their own private sets plus every set shared account-wide for it. */
export function listStaffSets(
  accessToken: string,
  locationId: string,
): Promise<{ staffSets: StaffSet[] }> {
  const params = new URLSearchParams({ locationId }).toString();
  return request(`/bookings/staff-sets?${params}`, { headers: authHeaders(accessToken) });
}

export interface StaffSetPayload {
  locationId: string;
  name: string;
  staffUserIds: string[];
  /** Defaults to false (private to the creator) server-side. */
  isShared?: boolean;
}

export function createStaffSet(
  accessToken: string,
  payload: StaffSetPayload,
): Promise<{ staffSet: StaffSet }> {
  return request("/bookings/staff-sets", {
    method: "POST",
    body: payload,
    headers: authHeaders(accessToken),
  });
}

export interface StaffSetUpdatePayload {
  locationId: string;
  name?: string;
  staffUserIds?: string[];
  isShared?: boolean;
}

/** Rename, member edit, and the share toggle all go through this one PATCH. */
export function updateStaffSet(
  accessToken: string,
  staffSetId: string,
  payload: StaffSetUpdatePayload,
): Promise<{ staffSet: StaffSet }> {
  return request(`/bookings/staff-sets/${staffSetId}`, {
    method: "PATCH",
    body: payload,
    headers: authHeaders(accessToken),
  });
}

/** DELETE carries no body, so the location travels as a query parameter. */
export function deleteStaffSet(
  accessToken: string,
  staffSetId: string,
  locationId: string,
): Promise<void> {
  const params = new URLSearchParams({ locationId }).toString();
  return request(`/bookings/staff-sets/${staffSetId}?${params}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
}

/** Persists a full drag-reorder of every set visible to the caller — pass the complete desired order. */
export function reorderStaffSets(
  accessToken: string,
  staffSetIds: string[],
  locationId: string,
): Promise<{ staffSets: StaffSet[] }> {
  return request("/bookings/staff-sets/reorder", {
    method: "POST",
    body: { staffSetIds, locationId },
    headers: authHeaders(accessToken),
  });
}

export function setDefaultStaffSet(
  accessToken: string,
  staffSetId: string,
  isDefault: boolean,
  locationId: string,
): Promise<{ staffSet: StaffSet }> {
  return request(`/bookings/staff-sets/${staffSetId}/default`, {
    method: "POST",
    body: { isDefault, locationId },
    headers: authHeaders(accessToken),
  });
}

export interface StaffShift {
  staffUserId: string;
  /** Empty when isOff is true. */
  ranges: { startTime: string; endTime: string }[];
  isOff: boolean;
}

/**
 * Effective working hours on `date` ("YYYY-MM-DD") for each of
 * `staffUserIds` — a date-specific override wins outright when one
 * exists, otherwise this falls back to their recurring weekly schedule.
 * Backs the staff picker's "on shift today" grouping and the Day view's
 * greyed-out-outside-shift cells.
 */
export function getStaffShifts(
  accessToken: string,
  date: string,
  staffUserIds: string[],
  locationId: string,
): Promise<{ shifts: StaffShift[] }> {
  const params = new URLSearchParams({ date, staffUserIds: staffUserIds.join(",") });
  if (locationId) params.set("locationId", locationId);
  return request(`/bookings/staff-shifts?${params.toString()}`, {
    headers: authHeaders(accessToken),
  });
}

export interface BookingReview {
  bookingId: string;
  /** 1-5, set by the customer through the marketplace review flow — not editable here. */
  rating: number;
  comment: string | null;
  createdAt: string;
}

/**
 * Reviews for a batch of bookings — backs the List view's Past tab and the
 * appointment detail modal's "What the customer said" section. Only
 * bookings that actually have a review come back; treat a missing
 * bookingId as "no review yet" rather than an empty one.
 */
export function getBookingReviews(
  accessToken: string,
  bookingIds: string[],
): Promise<{ reviews: BookingReview[] }> {
  if (bookingIds.length === 0) return Promise.resolve({ reviews: [] });
  const params = new URLSearchParams({ bookingIds: bookingIds.join(",") });
  return request(`/bookings/reviews?${params.toString()}`, {
    headers: authHeaders(accessToken),
  });
}
