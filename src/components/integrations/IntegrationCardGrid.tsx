import type { Integration } from "@/lib/sample-data";

interface IntegrationCardGridProps {
  integrations: Integration[];
  search: string;
}

/** The card grid — shared by both Integrations entry points, see CategoryNav.tsx. */
export function IntegrationCardGrid({ integrations, search }: IntegrationCardGridProps) {
  if (integrations.length === 0) {
    return (
      <p className="m-0 font-sans text-sm text-tn-muted-5">
        No integrations match &ldquo;{search}&rdquo;.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {integrations.map((integration) => (
        <div
          key={integration.id}
          className="flex flex-col gap-2 rounded-2xl border border-tn-border p-[18px]"
        >
          <div className="flex items-center gap-2">
            <span aria-hidden>{integration.icon}</span>
            <span className="font-sans text-sm font-semibold text-tn-ink">{integration.name}</span>
            {integration.connected && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-tn-success" aria-hidden />
            )}
          </div>
          <p className="m-0 font-sans text-xs leading-relaxed text-tn-muted-5">
            {integration.description}
          </p>
        </div>
      ))}
    </div>
  );
}

export default IntegrationCardGrid;
