import { WHATS_NEW } from "@/lib/sample-data";

interface WhatsNewDrawerProps {
  open: boolean;
  onClose: () => void;
}

/** Matches the mockup's T6b "What's New" popover, anchored above the sidebar's What's New row. */
export function WhatsNewDrawer({ open, onClose }: WhatsNewDrawerProps) {
  if (!open) return null;

  const [latest, ...previous] = WHATS_NEW;

  return (
    <div
      className="absolute bottom-[90px] left-6 z-10 flex max-h-[480px] w-[340px] flex-col rounded-tl-2xl rounded-tr-2xl rounded-br-2xl rounded-bl-sm border border-tn-border bg-tn-surface"
      style={{ boxShadow: "0 20px 50px -18px rgba(40,30,10,.3)" }}
    >
      <div className="flex items-center justify-between border-b border-tn-border-soft px-5 py-[18px]">
        <div className="flex items-center gap-2">
          <span aria-hidden>🚀</span>
          <span className="font-sans text-base font-semibold text-tn-ink">What&rsquo;s New</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="cursor-pointer border-none bg-transparent font-sans text-base text-tn-muted-6"
        >
          &times;
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-5 py-[18px]">
        {latest && (
          <div className="flex flex-col gap-2.5 rounded-2xl border border-tn-border bg-tn-page p-4">
            <span className="flex w-fit items-center gap-1 rounded-full bg-tn-dark px-2.5 py-1 font-sans text-[11px] font-semibold text-tn-on-dark">
              ★ Latest
            </span>
            <div className="flex items-center gap-2.5 font-sans text-xs font-medium text-tn-muted-5">
              <span className="rounded-md border border-tn-input-border px-2 py-0.5">
                {latest.version}
              </span>
              <span>{latest.date}</span>
            </div>
            <p className="m-0 font-sans text-base font-semibold text-tn-ink">{latest.title}</p>
            <p className="m-0 font-sans text-[13px] leading-relaxed text-tn-muted-4">
              {latest.body}
            </p>
          </div>
        )}

        <div className="flex items-center gap-2.5">
          <div className="h-px flex-1 bg-tn-border-softer" />
          <span className="font-sans text-xs font-medium text-tn-muted-6">Previous Releases</span>
          <div className="h-px flex-1 bg-tn-border-softer" />
        </div>

        {previous.map((item) => (
          <div
            key={item.version}
            className="flex flex-col gap-1.5 rounded-xl border border-tn-border-softer p-3.5"
          >
            <div className="flex items-center gap-2 font-sans text-xs font-medium text-tn-muted-6">
              <span>{item.version}</span>
              <span>{item.date}</span>
            </div>
            <p className="m-0 font-sans text-sm font-semibold text-tn-ink">{item.title}</p>
            <p className="m-0 font-sans text-xs leading-relaxed text-tn-muted-5">{item.body}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-tn-border-soft px-5 py-3.5">
        <span className="flex cursor-pointer items-center gap-1.5 font-sans text-[13px] font-semibold text-tn-ink-soft">
          View All ↗
        </span>
      </div>
    </div>
  );
}

export default WhatsNewDrawer;
