import { useEffect, useRef, useState } from "react";
import {
  ACCEPTED_IMAGE_TYPES,
  UploadError,
  uploadFile,
  type UploadPurpose,
} from "@/lib/upload-file";

/**
 * Choose an image, watch it upload, hand back the key.
 *
 * The preview is the *local* file, shown the instant it is chosen and
 * kept until the parent's own data comes back with the stored image. That
 * is the whole reason this feels quick: the bytes are already on the
 * device, so there is no reason to make somebody wait for a round trip to
 * see the photograph they just picked. `URL.createObjectURL` rather than
 * a FileReader data URL — it is synchronous, costs no memory copy of a
 * 4 MB file, and is revoked below when it stops being needed.
 *
 * The bar is real. See lib/upload-file.ts: the bytes go straight to
 * object storage and every percent is data that has left the device.
 */
export function ImageUpload({
  purpose,
  subjectId,
  accessToken,
  currentUrl,
  onUploaded,
  onRemove,
  label,
  hint,
  disabled = false,
  aspect = "wide",
  variant = "field",
}: {
  purpose: UploadPurpose;
  /** The branch or staff member this belongs to. Omitted for the shop cover. */
  subjectId?: string;
  accessToken: string;
  /** What is stored today — a signed URL from the API, or null. */
  currentUrl: string | null;
  /** Called with the object key once the bytes are up. Save it on the resource. */
  onUploaded: (key: string) => Promise<void> | void;
  /** Omitted when there is nothing to remove, e.g. a gallery that deletes its own tiles. */
  onRemove?: () => Promise<void> | void;
  label: string;
  hint?: string;
  disabled?: boolean;
  aspect?: "wide" | "square";
  /**
   * "field" is the labelled control with a Replace/Remove row under it —
   * a cover photo, an avatar, one slot with one image in it.
   *
   * "tile" is the last cell of a gallery grid: it fills its cell, carries
   * its label inside as the call to action, and has no buttons under it
   * because the grid around it is where adding and removing happen. Same
   * upload, same progress bar, same refusals — only the frame differs,
   * which is why it is a variant rather than a second component that
   * would drift from this one.
   */
  variant?: "field" | "tile";
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fraction, setFraction] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * The preview URL, mirrored into a ref purely so the cleanup below can
   * revoke it without depending on it.
   *
   * This used to be `useEffect(..., [previewUrl])`, and that dependency
   * made the component cancel its own uploads: choosing a file sets the
   * preview, the changed dependency runs the *previous* effect's cleanup,
   * and the cleanup calls `abortRef.current.abort()` — on the upload that
   * had just started. An effect whose cleanup tears down a long-running
   * operation has to run once, on unmount, and nothing else can be in its
   * dependency array.
   */
  const previewUrlRef = useRef<string | null>(null);

  // An object URL is a reference into the page's memory; letting it go on
  // unmount is the difference between a preview and a leak. Empty deps —
  // see above.
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const uploading = fraction !== null;
  const shown = previewUrl ?? currentUrl;

  async function handleFile(file: File) {
    setError(null);
    const objectUrl = URL.createObjectURL(file);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = objectUrl;
    setPreviewUrl(objectUrl);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const key = await uploadFile(file, purpose, {
        subjectId,
        accessToken,
        signal: controller.signal,
        onProgress: ({ fraction: next }) => setFraction(next),
      });
      await onUploaded(key);
      // The parent has the real image now; drop the local preview so the
      // two can't drift — the stored one is what everybody else sees.
      setPreviewUrl(null);
      previewUrlRef.current = null;
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      URL.revokeObjectURL(objectUrl);
      previewUrlRef.current = null;
      setPreviewUrl(null);
      setError(
        err instanceof UploadError || err instanceof Error
          ? err.message
          : "That didn’t upload — try again.",
      );
    } finally {
      setFraction(null);
      abortRef.current = null;
    }
  }

  const isTile = variant === "tile";

  return (
    <div className={isTile ? "contents" : "flex flex-col gap-2"}>
      <div className={`flex items-baseline justify-between gap-2 ${isTile ? "hidden" : ""}`}>
        <span className="font-sans text-xs font-semibold text-tn-ink">{label}</span>
        {uploading && (
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className="cursor-pointer border-none bg-transparent p-0 font-sans text-[11px] font-semibold text-tn-muted-5 underline"
          >
            Cancel
          </button>
        )}
      </div>

      <div
        className={`relative overflow-hidden rounded-xl border border-dashed border-tn-input-border bg-tn-page ${
          aspect === "wide"
            ? "aspect-[16/6]"
            : isTile
              ? "aspect-square w-full"
              : "aspect-square w-[120px]"
        }`}
      >
        {shown ? (
          <img
            src={shown}
            alt=""
            className={`h-full w-full object-cover transition-opacity ${uploading ? "opacity-60" : "opacity-100"}`}
          />
        ) : (
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
            className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 border-none bg-transparent font-sans text-[12px] text-tn-muted-5 hover:bg-tn-surface disabled:cursor-default"
          >
            {isTile && <span className="text-lg leading-none">+</span>}
            {isTile ? label : "Choose an image"}
          </button>
        )}

        {/* Sits over the image rather than under it: while an upload is
            running the thing being replaced is still what's on screen,
            and the bar belongs to it. */}
        {uploading && (
          <>
            {/* Two elements for one bar, deliberately. The painted one is
                a 4px strip that has to sit over the image and animate,
                which a <progress> cannot be made to do consistently
                across browsers; the real <progress> is the one assistive
                tech reads, and is the element the platform already knows
                how to announce. */}
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-black/10">
              <div
                className="h-full bg-tn-gold transition-[width] duration-150 ease-out"
                style={{ width: `${Math.round((fraction ?? 0) * 100)}%` }}
              />
            </div>
            <progress
              className="sr-only"
              max={100}
              value={Math.round((fraction ?? 0) * 100)}
              aria-label={`Uploading ${label}`}
            />
          </>
        )}
      </div>

      <div className={`flex items-center gap-3 ${isTile ? "hidden" : ""}`}>
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className="cursor-pointer rounded-lg border border-tn-input-border bg-tn-surface px-3 py-1.5 font-sans text-[11.5px] font-semibold text-tn-ink hover:bg-tn-page disabled:opacity-50"
        >
          {uploading
            ? `Uploading ${Math.round((fraction ?? 0) * 100)}%`
            : shown
              ? "Replace"
              : "Upload"}
        </button>
        {shown && onRemove && !uploading && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => void onRemove()}
            className="cursor-pointer border-none bg-transparent p-0 font-sans text-[11.5px] font-semibold text-tn-danger disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>

      {hint && !error && !isTile && (
        <p className="m-0 font-sans text-[11px] leading-relaxed text-tn-muted-5">{hint}</p>
      )}
      {error && (
        <p className={`m-0 font-sans text-[11px] text-tn-danger ${isTile ? "col-span-full" : ""}`}>
          {error}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Cleared straight away so choosing the same file twice still
          // fires a change event — otherwise a failed upload can't be
          // retried with the same picture.
          event.target.value = "";
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}

export default ImageUpload;
