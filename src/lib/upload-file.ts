import { request } from "./http";

/**
 * Puts a file in object storage and reports how far it got.
 *
 * Two calls: ask this API to sign a URL, then PUT the bytes to S3
 * directly. The second never touches our servers — which is what makes
 * the progress real. Every percent is data that has actually left the
 * device, not a timer animating on a spinner's behalf.
 *
 * It is `XMLHttpRequest` and not `fetch` for exactly one reason: fetch
 * has no upload progress. You send a body and wait; there are no events
 * until the response starts. (Streaming request bodies with
 * `duplex: "half"` would do it, and are Chromium-only and refuse
 * HTTP/1.1.) XHR has reported `upload.onprogress` since long before any
 * of this, so the one call that needs it uses the older API and the rest
 * of the app stays on fetch.
 */

export type UploadPurpose = "shop-cover" | "location-photo" | "staff-avatar" | "portfolio";

interface PresignResponse {
  uploadUrl: string;
  key: string;
  contentType: string;
  expiresInSeconds: number;
  maxBytes: number;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  /** 0–1. Deliberately short of 1 until the server has acknowledged — see below. */
  fraction: number;
}

export class UploadError extends Error {}

/** Matches the backend's own limit, so the failure happens before the bytes move rather than after. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const ACCEPTED = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
];

/** The `accept` attribute for a file input, kept next to the list it has to agree with. */
export const ACCEPTED_IMAGE_TYPES = ACCEPTED.join(",");

/** Why this file can't be uploaded, in words for the person who chose it — or null if it can. */
export function rejectionFor(file: File): string | null {
  if (!ACCEPTED.includes(file.type.toLowerCase())) {
    return "That file isn’t an image we can use — choose a JPEG, PNG, WEBP or HEIC.";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    const megabytes = (file.size / (1024 * 1024)).toFixed(1);
    return `That image is ${megabytes} MB and the limit is 4 MB. Your phone’s “medium” share size is usually well under it.`;
  }
  return null;
}

function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (progress: UploadProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    /**
     * Content-Type and nothing else. It was signed into the URL, so it
     * must match exactly — and any *extra* header is equally fatal,
     * because the signature covers the headers S3 receives. In
     * particular: no Authorization. The URL is the credential, and
     * attaching our bearer token would hand it to a third party for
     * nothing.
     */
    xhr.setRequestHeader("Content-Type", contentType);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress({
        loaded: event.loaded,
        total: event.total,
        /**
         * Held just under 1 while the request is open. `loaded === total`
         * means the last byte was handed to the operating system, not
         * that S3 accepted it — a bar that reaches 100% and sits there
         * reads as a hang, and one that reaches 100% and then fails reads
         * as a lie. The last percent belongs to the response.
         */
        fraction: Math.min(0.99, event.loaded / event.total),
      });
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress({ loaded: file.size, total: file.size, fraction: 1 });
        resolve();
        return;
      }
      reject(
        new UploadError(
          xhr.status === 403
            ? "That upload link expired — choose the image again."
            : "The upload didn’t go through. Check your connection and try again.",
        ),
      );
    };
    xhr.onerror = () =>
      reject(new UploadError("The upload didn’t go through. Check your connection and try again."));
    xhr.ontimeout = () =>
      reject(new UploadError("The upload timed out — try again on a better connection."));
    xhr.onabort = () => reject(new UploadError("Upload cancelled"));

    if (signal) {
      /**
       * An already-aborted signal has to reject, not return.
       *
       * This returned early, which left the promise neither resolved nor
       * rejected — so an upload cancelled before its bytes started moving
       * hung for ever, and the caller's `finally` never ran. On screen
       * that is a progress bar frozen at 0% with no error and no way out,
       * which is a far worse failure than the cancellation it was
       * reporting.
       */
      if (signal.aborted) {
        reject(new UploadError("Upload cancelled"));
        return;
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(file);
  });
}

/**
 * Sign, upload, hand back the key.
 *
 * The key is what a resource endpoint stores. Nothing else about the
 * bucket — not its name, not the folder, not the region — reaches this
 * app, which is deliberate: the layout is the server's to change.
 *
 * `subjectId` is the branch for an ambience photo and the staff member
 * for an avatar or portfolio piece. The shop cover has no subject; it
 * belongs to the account.
 */
export async function uploadFile(
  file: File,
  purpose: UploadPurpose,
  options: {
    subjectId?: string;
    accessToken: string;
    onProgress?: (progress: UploadProgress) => void;
    signal?: AbortSignal;
  },
): Promise<string> {
  const onProgress = options.onProgress ?? (() => {});
  const rejection = rejectionFor(file);
  if (rejection) throw new UploadError(rejection);

  // Zero before anything is signed, so a slow signing call leaves the bar
  // at the start rather than undefined.
  onProgress({ loaded: 0, total: file.size, fraction: 0 });

  const presigned = await request<PresignResponse>("/uploads/presign", {
    method: "POST",
    headers: { Authorization: `Bearer ${options.accessToken}` },
    body: {
      purpose,
      ...(options.subjectId ? { subjectId: options.subjectId } : {}),
      contentType: file.type,
      byteSize: file.size,
    },
  });

  await putWithProgress(
    presigned.uploadUrl,
    file,
    presigned.contentType,
    onProgress,
    options.signal,
  );
  return presigned.key;
}
