import { request } from "./http";

/**
 * Talks to igroom-backend's /customers module (see customers.service.ts) —
 * T10c's Customers table + stat tiles and T10d's Customer Journey drawer.
 * Every route requires a bearer token — requireAccountAuth derives
 * accountId from it server-side, same pattern as staff-api.ts/
 * services-api.ts. Customers span every location on the account, same as
 * staff (a client might visit more than one of a shop's locations).
 */

export type CustomerSource = "app" | "walk_in" | "staff_added";

/** Computed, not stored — see customers.service.ts's computeTag for the priority order (Inactive > VIP > New). */
export type CustomerTag = "VIP" | "New" | "Inactive" | null;

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  /** "app" is reserved for a future mobile-app self-signup — every customer today is "staff_added". */
  source: CustomerSource;
  isVip: boolean;
  tag: CustomerTag;
  /** Count of this customer's non-cancelled bookings. */
  visits: number;
  lifetimeSpendCents: number;
  /** lifetimeSpendCents ÷ visits, or null if visits is 0. */
  avgTicketCents: number | null;
  /** null unless this customer has at least 2 visits. */
  avgWeeksBetweenVisits: number | null;
  lastVisitAt: string | null;
  /** Name of the staff member this customer has booked with most often. */
  preferredBarber: string | null;
  memberSince: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerStats {
  totalCustomers: number;
  newThisMonth: number;
  /** % of customers with at least one visit who have more than one, rounded. */
  repeatRatePct: number;
  avgLifetimeSpendCents: number;
}

export type BookingStatus = "confirmed" | "walk_in" | "cancelled" | "completed" | "no_show";

export interface CustomerJourneyEntry {
  id: string;
  date: string;
  serviceName: string;
  staffName: string;
  priceCents: number | null;
  status: BookingStatus;
}

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

/** T10c's full client list plus the account-wide stat tiles — search/filter (All/VIP/New/Inactive 90d+) happens client-side over this same list, same as T10's Staff roster. */
export function listCustomers(
  accessToken: string,
): Promise<{ customers: Customer[]; stats: CustomerStats }> {
  return request("/customers", { headers: authHeaders(accessToken) });
}

export interface CreateCustomerInput {
  name: string;
  phone?: string;
  email?: string;
  isVip?: boolean;
}

/** T10c's "+ Add Customer". */
export function createCustomer(
  accessToken: string,
  input: CreateCustomerInput,
): Promise<{ customer: Customer }> {
  return request("/customers", { method: "POST", body: input, headers: authHeaders(accessToken) });
}

/** T10d's Customer Journey drawer — one customer plus their full booking history, newest first. */
export function getCustomer(
  accessToken: string,
  customerId: string,
): Promise<{ customer: Customer; journey: CustomerJourneyEntry[] }> {
  return request(`/customers/${customerId}`, { headers: authHeaders(accessToken) });
}

export interface UpdateCustomerInput {
  name?: string;
  phone?: string;
  email?: string;
  isVip?: boolean;
}

export function updateCustomer(
  accessToken: string,
  customerId: string,
  patch: UpdateCustomerInput,
): Promise<{ customer: Customer }> {
  return request(`/customers/${customerId}`, {
    method: "PATCH",
    body: patch,
    headers: authHeaders(accessToken),
  });
}
