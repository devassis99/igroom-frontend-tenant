import { ApiError } from "@/lib/http";

/**
 * The nav hides a screen the caller has no permission for, but the URL
 * is still reachable — someone lands here from a bookmark, or a shared
 * link, or by typing it. Showing the ordinary page furnished with zeroes
 * is the worst of the options: an empty till and a live-looking "close
 * the day" button read as "the shop took nothing tonight", not as "this
 * is not yours to see".
 */
export function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

export function PermissionNotice({ title, what }: { title: string; what: string }) {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="m-0 font-serif text-[26px] font-semibold text-tn-ink">{title}</h1>
      <div className="max-w-[62ch] rounded-2xl border border-tn-border bg-tn-surface px-5 py-6">
        <p className="m-0 font-sans text-sm font-semibold text-tn-ink">
          You don&rsquo;t have access to this screen
        </p>
        <p className="m-0 mt-1.5 font-sans text-[13px] leading-relaxed text-tn-muted-3">
          {what} An owner or manager can grant it under Settings &rsaquo; Roles &amp; permissions.
        </p>
      </div>
    </div>
  );
}
