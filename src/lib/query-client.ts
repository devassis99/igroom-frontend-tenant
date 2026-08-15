import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./http";

/**
 * Same tuning as igroom-frontend-bo's src/lib/query-client.ts: staleTime
 * above 0 so switching between screens that share a query doesn't refetch
 * on every mount, and 401/403/404 skip retries since they're never
 * transient. Nothing queries the network yet (no tenant backend — see
 * env.ts), but pages are structured to adopt this the moment one exists.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && [401, 403, 404].includes(error.status)) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
