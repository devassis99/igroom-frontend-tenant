import { request } from "./http";

/**
 * What POST /accounts/support-session/redeem hands back. Note what's
 * missing: there is no refreshToken. A support session is a fixed window
 * — when the access token runs out the session is genuinely over, and
 * getting back in means a back-office operator minting a new ticket,
 * which writes a new audit row. That's the point: a session can't quietly
 * extend itself for days.
 */
export interface RedeemedSupportSession {
  accessToken: string;
  expiresAt: string;
  support: {
    sessionId: string;
    readOnly: true;
    shopName: string;
  };
  staffUser: {
    id: string;
    accountId: string;
    locationIds: string[];
    name: string;
    email: string;
    roleId: string | null;
  };
  account: {
    id: string;
    name: string;
    category: string | null;
    address: string | null;
    phone: string | null;
  };
  locationName: string | null;
  /** The assumed staff member's permission keys — see auth/route-permissions.ts. */
  permissions: string[];
}

/**
 * Exchanges the single-use ticket from the URL fragment for a read-only
 * session. Unauthenticated — the ticket is the credential, which is why
 * it only works once and only for about a minute after it was minted.
 */
export function redeemSupportSession(ticket: string): Promise<RedeemedSupportSession> {
  return request<RedeemedSupportSession>("/accounts/support-session/redeem", {
    method: "POST",
    body: { ticket },
  });
}

/** Ends the session server-side, so the token stops working on its very next request rather than lingering until it expires. */
export function endSupportSession(accessToken: string): Promise<void> {
  return request<void>("/accounts/support-session/end", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
