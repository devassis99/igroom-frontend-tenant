const ROWS = [
  { label: "Change password", detail: null },
  { label: "Two-factor authentication", detail: "Not enabled" },
  { label: "Active sessions", detail: null },
];

/** Matches the mockup's T12c Security page. */
export function SecuritySettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="m-0 font-sans text-2xl font-semibold text-tn-ink">Security</h1>

      <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border">
        {ROWS.map((row, i) => (
          <button
            key={row.label}
            type="button"
            className={`flex items-center justify-between px-5 py-4 text-left ${
              i < ROWS.length - 1 ? "border-b border-tn-border-soft" : ""
            }`}
          >
            <div>
              <span className="font-sans text-sm font-medium text-tn-ink-soft">{row.label}</span>
              {row.detail && (
                <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">{row.detail}</p>
              )}
            </div>
            <span className="text-tn-muted-6" aria-hidden>
              ›
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default SecuritySettingsPage;
