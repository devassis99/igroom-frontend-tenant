import { request, ApiError } from "./http";

/**
 * The overlap guard (igroom-backend's shared/collision.ts).
 *
 * Two shops' hours are only comparable as instants — "Thu 11:00" in
 * London and "Thu 16:00" in Lahore look like different halves of a day
 * and are in fact six overlapping hours. Everything below therefore
 * travels in UTC, and the local wall clock rides along only so a screen
 * can say what the manager originally typed.
 *
 * Three places produce these: a refused save (409 on PUT
 * /availability/…), a refused booking (409 on POST /bookings), and the
 * nightly sweep, whose findings are read from GET /collisions.
 */

/** One side of a clash — a shop, the rule as typed there, and the window it actually occupies. */
export interface CollisionSide {
  locationId: string;
  locationName: string;
  timezone: string | null;
  /** "YYYY-MM-DD" as that shop reads it. */
  localDate: string;
  /** "HH:mm" wall clock at that shop — what a manager would recognise. */
  localStart: string;
  localEnd: string;
  /** ISO instants — the only frame the two sides can be compared in. */
  startAt: string;
  endAt: string;
  /** Where this side came from, which decides whether this screen can edit it. */
  source: "weekly" | "override" | "booking";
}

export interface Collision {
  /** "overlap" is refused outright; "travel" can be accepted on a re-submit. */
  kind: "overlap" | "travel";
  overlapMinutes: number;
  gapMinutes: number;
  requiredGapMinutes: number;
  /** "YYYY-MM-DD" in UTC. */
  date: string;
  fromAt: string;
  toAt: string;
  /** "11:00Z-17:00Z" — the phrase the refusal quotes. */
  window: string;
  sides: CollisionSide[];
}

/** The refusal code the backend attaches, which decides what the panel may offer. */
export type CollisionCode = "DOUBLE_BOOKED" | "TRAVEL_BUFFER";

/**
 * Pulls a collision refusal out of a failed request.
 *
 * Returns null for anything else, so a caller can write
 * `const refusal = collisionRefusal(err); if (!refusal) throw err;`
 * and leave every other failure to the error state that already exists.
 */
export function collisionRefusal(
  err: unknown,
): { code: CollisionCode; message: string; collisions: Collision[] } | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null;
  const body = err.body as { code?: unknown; collisions?: unknown } | undefined;
  if (body?.code !== "DOUBLE_BOOKED" && body?.code !== "TRAVEL_BUFFER") return null;
  return {
    code: body.code,
    message: err.message,
    collisions: Array.isArray(body.collisions) ? (body.collisions as Collision[]) : [],
  };
}

/** A clash the nightly sweep found, which by definition nobody was present to be refused for. */
export interface CollisionFinding {
  id: string;
  kind: "overlap" | "travel";
  staffUserId: string;
  staffName: string;
  locationAId: string;
  locationAName: string;
  locationBId: string;
  locationBName: string;
  occursAt: string;
  endsAt: string;
  /** Minutes shared, for an overlap; minutes of gap, for a travel warning. */
  minutes: number;
  requiredGapMinutes: number;
  sourceA: string;
  sourceB: string;
}

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

/**
 * What the sweep last found. Filter to one member (the availability
 * editor's banner) or one shop (the locations list's badge) — unfiltered
 * is the whole account.
 */
export function listCollisions(
  accessToken: string,
  filter: { staffUserId?: string; locationId?: string } = {},
): Promise<{ findings: CollisionFinding[] }> {
  const query = new URLSearchParams();
  if (filter.staffUserId) query.set("staffUserId", filter.staffUserId);
  if (filter.locationId) query.set("locationId", filter.locationId);
  const suffix = query.toString() ? `?${query}` : "";
  return request(`/collisions${suffix}`, { headers: authHeaders(accessToken) });
}

/**
 * The account-wide travel buffer — minutes somebody needs between
 * finishing at one shop and starting at another. 0 turns the travel half
 * of the guard off; the overlap half has no setting. Requires
 * staff.manage: a barber shouldn't be able to widen the rule that stops
 * them being double-booked.
 */
export function updateSchedulingSettings(
  accessToken: string,
  locationChangeBufferMinutes: number,
): Promise<{ locationChangeBufferMinutes: number }> {
  return request("/accounts/settings/scheduling", {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: { locationChangeBufferMinutes },
  });
}
