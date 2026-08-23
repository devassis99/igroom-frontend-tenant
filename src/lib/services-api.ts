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

export interface Service {
  id: string;
  locationId: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface ServiceCategory {
  id: string;
  locationId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

/**
 * T9's full menu, sorted by the current drag order then name.
 *
 * `locationId` is optional and defaults server-side to the caller's own
 * location — which is what T9 itself wants. Staff Management passes one
 * explicitly because a member being edited can belong to a different
 * location than the owner doing the editing, and the Services tab has to
 * show *that* location's menu.
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
