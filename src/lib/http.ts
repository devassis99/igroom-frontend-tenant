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
    // igroom-backend's errorHandler (see error-handler.ts) always shapes
    // failures as `{ error: string }`, not `{ message: string }` — reading
    // the wrong key here meant every thrown ApiError fell back to the
    // generic "Request to ... failed" text below, silently swallowing
    // real backend messages like "An account already exists for this
    // email" or "Invalid email or password". `message` is still checked
    // as a fallback in case some endpoint ever shapes its body that way.
    const payloadMessage =
      payload && typeof payload === "object"
        ? ((payload as { error?: unknown; message?: unknown }).error ??
          (payload as { error?: unknown; message?: unknown }).message)
        : undefined;
    const message =
      typeof payloadMessage === "string" && payloadMessage.length > 0
        ? payloadMessage
        : `Request to ${path} failed with status ${response.status}`;
    throw new ApiError(response.status, message, payload);
  }

  return payload as T;
}
