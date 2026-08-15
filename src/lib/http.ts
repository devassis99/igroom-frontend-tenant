import { env } from "./env";

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Skip JSON-encoding `body` (e.g. FormData). Off by default. */
  raw?: boolean;
}

/**
 * Bare fetch wrapper: base URL + JSON in/out + typed errors — identical
 * shape to igroom-frontend-bo's src/lib/http.ts. Not called from anywhere
 * yet (see env.ts), kept ready for when igroom-backend grows tenant
 * endpoints so pages swap a SAMPLE_* constant for a real call without
 * needing a different fetch layer.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, raw, headers, ...rest } = options;

  const response = await fetch(`${env.VITE_API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      ...(raw ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : raw ? (body as BodyInit) : JSON.stringify(body),
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json().catch(() => undefined) : undefined;

  if (!response.ok) {
    const message =
      (payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message?: unknown }).message)
        : undefined) ?? `Request to ${path} failed with status ${response.status}`;
    throw new ApiError(response.status, message, payload);
  }

  return payload as T;
}
