import { request } from "./http";

/**
 * Talks to igroom-backend's /services module (see services.service.ts) —
 * the T9 Services table + T9b Add/Edit Service modal, plus the
 * "Categories" management modal. Every route requires a bearer token —
 * requireAccountAuth derives accountId/locationId from it server-side,
 * same pattern as bookings-api.ts.
 */

// No tax-rate management screen exists anywhere in the mockup — T9/T9b
// both just show this one fixed rate, so it's a shared display constant
// rather than something fetched from the backend.
export const SALES_TAX_LABEL = "Sales Tax 8.25%";

/** Where one catalogue service is sold, and on what terms. See the backend's shared/catalogue.ts. */
export interface ServiceOffering {
  locationId: string;
  locationName: string;
  /** Null means this location just takes the catalogue price. */
  priceCentsOverride: number | null;
  durationMinutesOverride: number | null;
  /** What this location actually charges / books out. */
  priceCents: number;
  durationMinutes: number;
}

export interface Service {
  id: string;
  categoryId: string | null;
  /** Denormalized from service_categories so the table never needs a second round trip just to label a row. */
  categoryName: string | null;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  taxable: boolean;
  onlineVisible: boolean;
  requiresDeposit: boolean;
  kioskBookable: boolean;
  isEnabled: boolean;
  sortOrder: number;
  /** Where this service is offered. Empty means it's in the catalogue but sold nowhere. */
  locations: ServiceOffering[];
  createdAt: string;
  updatedAt: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

/**
 * The account's whole catalogue, sorted by the current drag order then
 * name — which is what the Services page wants.
 *
 * `locationId` narrows it to what one site actually offers. Staff
 * Management passes one because a member can only be assigned services
 * their own location sells, and the booking form passes one for the same
 * reason.
 */
export function listServices(
  accessToken: string,
  locationId?: string,
): Promise<{ services: Service[] }> {
  const query = locationId ? `?locationId=${encodeURIComponent(locationId)}` : "";
  return request(`/services${query}`, { headers: authHeaders(accessToken) });
}

export interface ServiceInput {
  categoryId?: string | null;
  name: string;
  description?: string | null;
  durationMinutes: number;
  priceCents: number;
  taxable?: boolean;
  onlineVisible?: boolean;
  requiresDeposit?: boolean;
  kioskBookable?: boolean;
  /** Where to offer it from the start. Omit for every location — the backend's createService default. */
  locationIds?: string[];
}

export function createService(
  accessToken: string,
  input: ServiceInput,
): Promise<{ service: Service }> {
  return request("/services", { method: "POST", body: input, headers: authHeaders(accessToken) });
}

export interface ServiceUpdateInput extends Partial<ServiceInput> {
  /** The T9 list's STATUS pill — toggled directly from the row, not part of the T9b form. */
  isEnabled?: boolean;
}

export function updateService(
  accessToken: string,
  serviceId: string,
  patch: ServiceUpdateInput,
): Promise<{ service: Service }> {
  return request(`/services/${serviceId}`, {
    method: "PATCH",
    body: patch,
    headers: authHeaders(accessToken),
  });
}

/** Soft delete server-side — the row disappears from listServices immediately after. */
export function deleteService(accessToken: string, serviceId: string): Promise<void> {
  return request(`/services/${serviceId}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
}

/** Persists a full drag-reorder, or "Reset service order" (send the ids sorted alphabetically). */
export function reorderServices(
  accessToken: string,
  serviceIds: string[],
): Promise<{ services: Service[] }> {
  return request("/services/reorder", {
    method: "POST",
    body: { serviceIds },
    headers: authHeaders(accessToken),
  });
}

/** Backs both T9b's CATEGORY select and the "Categories" management modal. */
export function listCategories(accessToken: string): Promise<{ categories: ServiceCategory[] }> {
  return request("/services/categories", { headers: authHeaders(accessToken) });
}

export function createCategory(
  accessToken: string,
  name: string,
): Promise<{ category: ServiceCategory }> {
  return request("/services/categories", {
    method: "POST",
    body: { name },
    headers: authHeaders(accessToken),
  });
}

export function renameCategory(
  accessToken: string,
  categoryId: string,
  name: string,
): Promise<{ category: ServiceCategory }> {
  return request(`/services/categories/${categoryId}`, {
    method: "PATCH",
    body: { name },
    headers: authHeaders(accessToken),
  });
}

/** Services pointing at this category come back uncategorized, not deleted — see services.service.ts. */
export function deleteCategory(accessToken: string, categoryId: string): Promise<void> {
  return request(`/services/categories/${categoryId}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
}

/** One row of the "where does this run" checklist. Omit an override to inherit the catalogue's figure. */
export interface ServiceLocationInput {
  locationId: string;
  priceCents?: number | null;
  durationMinutes?: number | null;
}

/**
 * The Services page's LOCATIONS editor. PUT, not PATCH: the body is the
 * complete set of locations offering this service, so sending an empty
 * array is how you stop selling it everywhere.
 */
export function setServiceLocations(
  accessToken: string,
  serviceId: string,
  locations: ServiceLocationInput[],
): Promise<{ service: Service }> {
  return request(`/services/${serviceId}/locations`, {
    method: "PUT",
    body: { locations },
    headers: authHeaders(accessToken),
  });
}
