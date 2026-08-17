import { request } from "./http";

/** Talks to igroom-backend's GET /accounts/locations (see accounts.service.ts's listLocationsForAccount) — backs the location picker on Staff Management's Add New Member flow. */
export interface AccountLocation {
  id: string;
  name: string;
  address: string;
  status: "active" | "inactive";
  isPrimary: boolean;
}

export function listLocations(accessToken: string): Promise<{ locations: AccountLocation[] }> {
  return request("/accounts/locations", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
