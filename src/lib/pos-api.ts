import { request } from "./http";

/**
 * Talks to igroom-backend's /pos module — the register, the tip split
 * and close of day.
 *
 * Money is integer cents on the wire in both directions and is never
 * turned into a float on the way through. `formatCents` below is the
 * only place a number becomes a string for display; anything that does
 * arithmetic does it in cents.
 *
 * locationId is required everywhere for the same reason it is on the
 * bookings and waitlist calls: a staff member works at several branches
 * now, so there is no single location to fall back to, and a register
 * read against a guess is the wrong shop's till.
 */

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

export type PosTicketStatus = "open" | "paid" | "voided";
export type PosTenderMethod = "cash" | "card" | "payment_link" | "deposit" | "other";
export type PosTipRole = "chair" | "assist" | "desk";
export type StaffCompModel = "commission" | "hourly" | "chair_rent";

export interface RegisterLocation {
  id: string;
  name: string;
  timezone: string | null;
}

export interface RegisterAppointment {
  bookingId: string;
  startAt: string;
  endAt: string;
  customerName: string;
  serviceName: string;
  durationMinutes: number;
  priceCents: number;
  staffUserId: string | null;
  staffName: string | null;
  status: string;
  /** What the marketplace already collected — 0, a deposit, or the whole price. */
  paidOnlineCents: number;
  onlinePaymentType: "deposit" | "full" | null;
  remainingCents: number;
  ticketId: string | null;
  ticketStatus: PosTicketStatus | null;
  ticketNumber: number | null;
}

export interface RegisterDay {
  locationId: string;
  businessDate: string;
  shopName: string;
  appointments: RegisterAppointment[];
  openTicketCount: number;
}

export interface PosTicketItem {
  id: string;
  kind: "service" | "product" | "adjustment";
  name: string;
  staffUserId: string | null;
  staffName: string | null;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface PosTender {
  id: string;
  method: PosTenderMethod;
  status: "pending" | "settled" | "failed";
  amountCents: number;
  cardLast4: string | null;
  externalRef: string | null;
  receivedAt: string;
}

export interface PosTipShare {
  id: string;
  role: PosTipRole;
  staffUserId: string | null;
  staffName: string | null;
  amountCents: number;
  isOverride: boolean;
}

export interface PosTicket {
  id: string;
  ticketNumber: number;
  locationId: string;
  bookingId: string | null;
  customerName: string | null;
  status: PosTicketStatus;
  businessDate: string;
  subtotalCents: number;
  taxRateBps: number;
  taxCents: number;
  tipCents: number;
  depositAppliedCents: number;
  totalCents: number;
  /** Still to collect. Zero means the ticket can close. */
  balanceCents: number;
  closedAt: string | null;
  items: PosTicketItem[];
  tenders: PosTender[];
  tipShares: PosTipShare[];
}

export interface PosTipRule {
  id: string | null;
  name: string;
  locationId: string | null;
  /** True when this branch is falling back to the account-wide rule. */
  isInherited: boolean;
  shares: { role: PosTipRole; bps: number }[];
}

export interface DayCloseStaffRow {
  /** Null while the day is still open — there is no frozen payout row to settle yet. */
  id: string | null;
  staffUserId: string;
  name: string;
  compModel: StaffCompModel;
  commissionRate: number | null;
  chairRentCents: number | null;
  serviceCents: number;
  retailCents: number;
  tipsCents: number;
  /** Positive: the shop owes them. Negative: they owe the shop (chair rent). */
  payoutCents: number;
  status: "pending" | "paid" | "invoiced";
}

export interface DayClose {
  locationId: string;
  shopName: string;
  businessDate: string;
  status: "open" | "closed";
  openingFloatCents: number;
  cashSalesCents: number;
  expectedCashCents: number;
  countedCashCents: number | null;
  varianceCents: number | null;
  ticketCount: number;
  grossSalesCents: number;
  tipsCents: number;
  deskPoolCents: number;
  payoutTotalCents: number;
  closedAt: string | null;
  staff: DayCloseStaffRow[];
}

// --- reads -----------------------------------------------------------

export function getRegisterLocations(
  accessToken: string,
): Promise<{ locations: RegisterLocation[] }> {
  return request("/pos/locations", { headers: authHeaders(accessToken) });
}

export function getRegisterDay(
  accessToken: string,
  locationId: string,
  date?: string,
): Promise<RegisterDay> {
  const query = new URLSearchParams({ locationId });
  if (date) query.set("date", date);
  return request(`/pos/day?${query}`, { headers: authHeaders(accessToken) });
}

export function getTicket(accessToken: string, ticketId: string): Promise<PosTicket> {
  return request(`/pos/tickets/${ticketId}`, { headers: authHeaders(accessToken) });
}

export function getTipRule(accessToken: string, locationId: string): Promise<PosTipRule> {
  return request(`/pos/tip-rule?locationId=${encodeURIComponent(locationId)}`, {
    headers: authHeaders(accessToken),
  });
}

export function getDayClose(
  accessToken: string,
  locationId: string,
  date?: string,
): Promise<DayClose> {
  const query = new URLSearchParams({ locationId });
  if (date) query.set("date", date);
  return request(`/pos/close-of-day?${query}`, { headers: authHeaders(accessToken) });
}

// --- the register ----------------------------------------------------

/**
 * Opening a ticket for a booking that already has an open one returns
 * that ticket rather than a second, so a double tap on "Finish & pay"
 * cannot charge twice.
 */
export function openTicket(
  accessToken: string,
  input: { locationId: string; bookingId?: string; customerName?: string },
): Promise<PosTicket> {
  return request("/pos/tickets", {
    method: "POST",
    body: input,
    headers: authHeaders(accessToken),
  });
}

export function addTicketItem(
  accessToken: string,
  ticketId: string,
  input: {
    kind?: "service" | "adjustment";
    name: string;
    staffUserId?: string;
    quantity?: number;
    unitPriceCents: number;
  },
): Promise<PosTicket> {
  return request(`/pos/tickets/${ticketId}/items`, {
    method: "POST",
    body: input,
    headers: authHeaders(accessToken),
  });
}

export function removeTicketItem(
  accessToken: string,
  ticketId: string,
  itemId: string,
): Promise<PosTicket> {
  return request(`/pos/tickets/${ticketId}/items/${itemId}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
}

export function setTicketTip(
  accessToken: string,
  ticketId: string,
  input: {
    tipCents: number;
    assistStaffUserId?: string | null;
    override?: { role: PosTipRole; staffUserId: string | null; amountCents: number }[];
  },
): Promise<PosTicket> {
  return request(`/pos/tickets/${ticketId}/tip`, {
    method: "POST",
    body: input,
    headers: authHeaders(accessToken),
  });
}

export function addTender(
  accessToken: string,
  ticketId: string,
  input: {
    method: Exclude<PosTenderMethod, "deposit">;
    amountCents: number;
    cardLast4?: string;
    externalRef?: string;
  },
): Promise<PosTicket> {
  return request(`/pos/tickets/${ticketId}/tenders`, {
    method: "POST",
    body: input,
    headers: authHeaders(accessToken),
  });
}

export function settleTender(
  accessToken: string,
  ticketId: string,
  tenderId: string,
): Promise<PosTicket> {
  return request(`/pos/tickets/${ticketId}/tenders/${tenderId}/settle`, {
    method: "POST",
    headers: authHeaders(accessToken),
  });
}

export function removeTender(
  accessToken: string,
  ticketId: string,
  tenderId: string,
): Promise<PosTicket> {
  return request(`/pos/tickets/${ticketId}/tenders/${tenderId}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
}

export function closeTicket(accessToken: string, ticketId: string): Promise<PosTicket> {
  return request(`/pos/tickets/${ticketId}/close`, {
    method: "POST",
    headers: authHeaders(accessToken),
  });
}

export function voidTicket(accessToken: string, ticketId: string): Promise<PosTicket> {
  return request(`/pos/tickets/${ticketId}/void`, {
    method: "POST",
    headers: authHeaders(accessToken),
  });
}

// --- close of day ----------------------------------------------------

export function saveTipRule(
  accessToken: string,
  input: { locationId: string | null; name: string; shares: { role: PosTipRole; bps: number }[] },
): Promise<PosTipRule> {
  return request("/pos/tip-rule", {
    method: "PUT",
    body: input,
    headers: authHeaders(accessToken),
  });
}

export function closeDay(
  accessToken: string,
  input: {
    locationId: string;
    date?: string;
    countedCashCents: number;
    openingFloatCents?: number;
    notes?: string;
  },
): Promise<DayClose> {
  return request("/pos/close-of-day", {
    method: "POST",
    body: input,
    headers: authHeaders(accessToken),
  });
}

export function markPayoutPaid(accessToken: string, payoutId: string): Promise<DayClose> {
  return request(`/pos/payouts/${payoutId}/paid`, {
    method: "POST",
    headers: authHeaders(accessToken),
  });
}

// --- helpers ---------------------------------------------------------

export const posKeys = {
  locations: ["pos", "locations"] as const,
  day: (locationId: string, date?: string) => ["pos", "day", locationId, date ?? "today"] as const,
  ticket: (ticketId: string) => ["pos", "ticket", ticketId] as const,
  tipRule: (locationId: string) => ["pos", "tip-rule", locationId] as const,
  close: (locationId: string, date?: string) =>
    ["pos", "close-of-day", locationId, date ?? "today"] as const,
};

/**
 * The one place cents become a string. Everything else works in cents —
 * a register that does its arithmetic on "$67.00" is a register that
 * eventually charges $66.99.
 */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(cents));
  return `${sign}$${Math.floor(abs / 100).toLocaleString()}.${String(abs % 100).padStart(2, "0")}`;
}

/** "12.50" or "12" from a text field, back to cents. Anything unparseable is zero, never NaN. */
export function parseCents(input: string): number {
  const cleaned = input.replace(/[^0-9.]/g, "");
  if (!cleaned) return 0;
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}
