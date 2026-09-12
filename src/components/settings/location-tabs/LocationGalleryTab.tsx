import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { useAuthStore } from "@/auth/auth-store";
import {
  addLocationPhoto,
  listLocationPhotos,
  MAX_LOCATION_PHOTOS,
  removeLocationPhoto,
  updateLocationPhoto,
  type AccountLocation,
  type LocationPhoto,
} from "@/lib/locations-api";

/**
 * This branch's own photographs — the room, the chairs, the light.
 *
 * It used to sit on the Profile settings page, above a hard-coded list of
 * four tags and the words "12 photos", and it was a drawing: no upload,
 * no delete, and a count that was the same number for every account. More
 * to the point it was in the wrong place. A business has one brand cover
 * — that stays on Profile, where the name and the description are — but
 * the *rooms* are not shared. Shoreditch and Peckham are different
 * buildings, and a customer who opened Peckham's booking link and saw
 * Shoreditch's window has been shown the wrong shop.
 *
 * So it lives here, per branch, beside that branch's hours, staff, menu
 * and takings, and the photographs are real: they go to object storage
 * under this account's own prefix, they come back as short-lived signed
 * URLs, and deleting one removes the object too.
 */
export function LocationGalleryTab({
  location,
  canManage,
}: {
  location: AccountLocation;
  canManage: boolean;
}) {
  const accessToken = useAuthStore((s) => s.accessToken) ?? "";
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  /** The tile whose caption is being typed — at most one at a time. */
  const [editing, setEditing] = useState<string | null>(null);

  const photosQuery = useQuery({
    queryKey: ["location-photos", location.id],
    queryFn: () => listLocationPhotos(accessToken, location.id),
    enabled: Boolean(accessToken),
  });

  const photos = photosQuery.data?.photos ?? [];
  const full = photos.length >= MAX_LOCATION_PHOTOS;

  /** Every write ends the same way: re-read the list rather than patch it locally. Signed URLs expire; ids don't. */
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["location-photos", location.id] });

  const add = useMutation({
    mutationFn: (imageKey: string) => addLocationPhoto(accessToken, location.id, { imageKey }),
    onSuccess: async (result) => {
      setError(null);
      await refresh();
      // Straight into the caption field. It is the one moment somebody
      // knows what the photograph is of, and a caption asked for later is
      // a caption never written.
      setEditing(result.photo.id);
    },
    onError: (err: unknown) =>
      setError(err instanceof Error ? err.message : "Couldn’t add that photo"),
  });

  const rename = useMutation({
    mutationFn: (input: { photoId: string; caption: string | null }) =>
      updateLocationPhoto(accessToken, location.id, input.photoId, { caption: input.caption }),
    onSuccess: () => {
      setError(null);
      void refresh();
    },
    onError: (err: unknown) =>
      setError(err instanceof Error ? err.message : "Couldn’t save that caption"),
  });

  const remove = useMutation({
    mutationFn: (photoId: string) => removeLocationPhoto(accessToken, location.id, photoId),
    onSuccess: () => {
      setError(null);
      void refresh();
    },
    onError: (err: unknown) =>
      setError(err instanceof Error ? err.message : "Couldn’t remove that photo"),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="m-0 font-sans text-sm font-semibold text-tn-ink">Gallery</p>
          <p className="m-0 font-sans text-xs text-tn-muted-5">
            {location.name}’s own photographs. The first one leads this branch’s booking page.
          </p>
        </div>
        <span className="font-sans text-xs text-tn-muted-5">
          {photosQuery.isPending ? "Loading…" : `${photos.length} of ${MAX_LOCATION_PHOTOS} photos`}
        </span>
      </div>

      {error && <p className="m-0 font-sans text-[11px] text-tn-danger">{error}</p>}

      {photosQuery.isError ? (
        <p className="m-0 font-sans text-sm text-tn-danger">Couldn’t load this branch’s photos.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <PhotoTile
              key={photo.id}
              photo={photo}
              canManage={canManage}
              editing={editing === photo.id}
              onEdit={() => setEditing(photo.id)}
              onCaption={(caption) => {
                setEditing(null);
                if ((caption || null) !== photo.caption) {
                  rename.mutate({ photoId: photo.id, caption: caption || null });
                }
              }}
              onRemove={() => remove.mutate(photo.id)}
              removing={remove.isPending && remove.variables === photo.id}
            />
          ))}

          {/* The uploader is the last tile, and it disappears at the
              limit rather than failing at it — the API refuses a
              thirteenth photo, and finding that out after the bytes have
              gone up is the wrong order. */}
          {canManage && !full && !photosQuery.isPending ? (
            <ImageUpload
              purpose="location-photo"
              subjectId={location.id}
              accessToken={accessToken}
              currentUrl={null}
              onUploaded={async (key) => {
                await add.mutateAsync(key);
              }}
              label="Add"
              aspect="square"
              variant="tile"
              disabled={add.isPending}
            />
          ) : null}
        </div>
      )}

      {full && (
        <p className="m-0 font-sans text-xs text-tn-muted-6">
          That’s the {MAX_LOCATION_PHOTOS}-photo limit. Remove one to add another.
        </p>
      )}

      {!photosQuery.isPending && photos.length === 0 && (
        <p className="m-0 font-sans text-xs text-tn-muted-6">
          With nothing here, this branch’s booking page falls back to the business cover from
          Profile — fine for one shop, wrong for three. A photograph of this actual room does more
          for a booking than any stock one.
        </p>
      )}
    </div>
  );
}

function PhotoTile({
  photo,
  canManage,
  editing,
  onEdit,
  onCaption,
  onRemove,
  removing,
}: {
  photo: LocationPhoto;
  canManage: boolean;
  editing: boolean;
  onEdit: () => void;
  onCaption: (caption: string) => void;
  onRemove: () => void;
  removing: boolean;
}) {
  const [draft, setDraft] = useState(photo.caption ?? "");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) {
      setDraft(photo.caption ?? "");
      inputRef.current?.focus();
    }
  }, [editing, photo.caption]);

  return (
    <div className="group relative flex aspect-square flex-col justify-end overflow-hidden rounded-xl bg-tn-page">
      <img
        src={photo.imageUrl}
        alt={photo.caption ?? ""}
        className="absolute inset-0 h-full w-full object-cover"
      />

      {canManage && (
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          aria-label="Remove this photo"
          className="absolute top-2 right-2 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-none bg-tn-surface/90 font-sans text-[13px] leading-none text-tn-ink opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 disabled:opacity-50"
        >
          ×
        </button>
      )}

      <div className="relative z-10 p-2">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            maxLength={140}
            placeholder="Caption (optional)"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => onCaption(draft.trim())}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              // Escape abandons the edit rather than saving it — the
              // blur handler reads `draft`, so it is reset first.
              if (event.key === "Escape") {
                setDraft(photo.caption ?? "");
                event.currentTarget.blur();
              }
            }}
            className="w-full rounded-md border border-tn-input-border bg-tn-surface px-1.5 py-1 font-sans text-[10px] text-tn-ink outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={canManage ? onEdit : undefined}
            disabled={!canManage}
            className={`mx-auto block max-w-full truncate rounded-md border-none bg-tn-surface px-1.5 py-0.5 font-sans text-[10px] font-medium ${
              photo.caption ? "text-tn-muted-3" : "text-tn-placeholder"
            } ${canManage ? "cursor-pointer" : "cursor-default"}`}
          >
            {photo.caption ?? (canManage ? "Add a caption" : "")}
          </button>
        )}
      </div>
    </div>
  );
}

export default LocationGalleryTab;
