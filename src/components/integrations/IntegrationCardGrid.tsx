import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/auth/auth-store";
import { Button } from "@/components/ui/Button";
import {
  disconnectIntegration,
  googleCalendarConnectUrl,
  integrationKeys,
  syncIntegration,
  type Integration as LiveIntegration,
} from "@/lib/integrations-api";
import type { IntegrationCard } from "./useIntegrationsFilter";

export type LoadStatus = "pending" | "error" | "ready";

interface IntegrationCardGridProps {
  integrations: IntegrationCard[];
  search: string;
  /** Whether the live connection state has arrived — see the three-way footer in Card below. */
  status: LoadStatus;
}

/** The card grid — shared by both Integrations entry points, see CategoryNav.tsx. */
export function IntegrationCardGrid({ integrations, search, status }: IntegrationCardGridProps) {
  if (integrations.length === 0) {
    return (
      <p className="m-0 font-sans text-sm text-tn-muted-5">
        No integrations match &ldquo;{search}&rdquo;.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {integrations.map((card) => (
        <Card key={card.id} card={card} status={status} />
      ))}
    </div>
  );
}

function Card({ card, status }: { card: IntegrationCard; status: LoadStatus }) {
  const live = card.live;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-tn-border p-[18px]">
      <div className="flex items-center gap-2">
        <span aria-hidden>{card.icon}</span>
        <span className="font-sans text-sm font-semibold text-tn-ink">{card.name}</span>
        {card.connected && (
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-tn-success" aria-hidden />
        )}
      </div>
      <p className="m-0 font-sans text-xs leading-relaxed text-tn-muted-5">
        {live?.blurb ?? card.description}
      </p>
      {live ? <LiveControls live={live} /> : <Footer card={card} status={status} />}
    </div>
  );
}

/**
 * What a card says when it has no controls, which is three different
 * things and used to be one.
 *
 * Every card on this page began as a plain div with no handler and, on
 * four of them, a green "connected" dot — so "I can't click it" was the
 * correct reaction. The first fix replaced that with "Not available yet",
 * which was honest for a provider we haven't built and a lie for one
 * whose request simply failed: a 500 from the API produced a card that
 * calmly said "not available" and still could not be clicked. A provider
 * we do support says which of the two is happening.
 */
function Footer({ card, status }: { card: IntegrationCard; status: LoadStatus }) {
  if (!card.supported) {
    return (
      <span className="mt-auto pt-1 font-sans text-[11px] font-medium text-tn-muted-6">
        Not available yet
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="mt-auto pt-1 font-sans text-[11px] font-medium text-tn-muted-6">
        Checking&hellip;
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="mt-auto pt-1 font-sans text-[11px] font-medium text-tn-danger">
        Couldn&rsquo;t load — see the message above
      </span>
    );
  }
  // Reached the server, and it doesn't offer this one yet.
  return (
    <span className="mt-auto pt-1 font-sans text-[11px] font-medium text-tn-muted-6">
      Not available yet
    </span>
  );
}

function LiveControls({ live }: { live: LiveIntegration }) {
  const accessToken = useAuthStore((s) => s.accessToken) ?? "";
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: integrationKeys.all });

  const connect = useMutation({
    mutationFn: async () => {
      // Where the callback sends them back to. A path, not a URL: the
      // server resolves it against the tenant app's own origin, so this
      // can't be pointed anywhere else.
      const url = await googleCalendarConnectUrl(
        accessToken,
        `${window.location.pathname}${window.location.search}`,
      );
      // A full navigation, not a popup. Google's consent screen refuses
      // to run in an iframe, popups get blocked, and the barber has to
      // land back in this app afterwards anyway.
      window.location.assign(url);
    },
    onError: (e: Error) => setError(e.message),
  });

  const sync = useMutation({
    mutationFn: () => syncIntegration(accessToken, live.id),
    onSuccess: refresh,
    onError: (e: Error) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: () => disconnectIntegration(accessToken, live.provider),
    onSuccess: refresh,
    onError: (e: Error) => setError(e.message),
  });

  const isConnected = live.status === "connected";
  const needsReauth = live.status === "needs_reauth";

  return (
    <div className="mt-auto flex flex-col gap-2 pt-1">
      {isConnected && (
        <div className="flex flex-col gap-0.5">
          {live.connectedAs && (
            <span className="truncate font-sans text-[11.5px] text-tn-ink-soft">
              {live.connectedAs}
            </span>
          )}
          {/* The number, because it is the only honest proof the thing is
              doing anything. "Connected" on its own is a claim; "6 events
              blocking time" is a fact the barber can go and check. */}
          <span className="font-sans text-[11px] text-tn-muted-5">
            {live.blockedCount === 0
              ? "Nothing on it is blocking time yet"
              : `${live.blockedCount} ${live.blockedCount === 1 ? "event is" : "events are"} blocking time`}
            {live.lastSyncedAt ? ` · checked ${relativeTime(live.lastSyncedAt)}` : ""}
          </span>
        </div>
      )}

      {needsReauth && (
        <p className="m-0 font-sans text-[11px] leading-relaxed text-tn-danger">
          Google stopped accepting our access — reconnect to start blocking time again. Anything
          already blocked stays put in the meantime.
        </p>
      )}

      {live.scope === "staff" &&
        !isConnected &&
        !needsReauth && (
          // Said before they click, not after. An owner cannot connect a
          // barber's calendar for them — nobody can authorise somebody
          // else's Google account — and finding that out at Google's
          // consent screen is finding it out too late.
          <span className="font-sans text-[11px] text-tn-muted-6">
            Connects your own calendar. Each barber connects theirs.
          </span>
        )}

      <div className="flex flex-wrap gap-2">
        {isConnected ? (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => sync.mutate()}
              disabled={sync.isPending}
            >
              {sync.isPending ? "Checking…" : "Check now"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
            >
              Disconnect
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={() => connect.mutate()} disabled={connect.isPending}>
            {needsReauth ? "Reconnect" : "Connect"}
          </Button>
        )}
      </div>

      {(error ?? live.lastError) && (
        <p className="m-0 font-sans text-[11px] leading-relaxed text-tn-danger">
          {error ?? live.lastError}
        </p>
      )}
    </div>
  );
}

/** "4 minutes ago", from an ISO instant. Coarse on purpose — this is reassurance, not telemetry. */
function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default IntegrationCardGrid;
