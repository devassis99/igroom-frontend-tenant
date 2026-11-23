import { LOCALES, getLocale, setLocale, t, type LocaleCode } from "@/i18n";

/**
 * Choosing the app's language.
 *
 * Two shapes, one behaviour: picking a language saves it on this device
 * and reloads into it (see src/i18n). Each language is listed in its own
 * name — "Français", not "French" — because the person looking for it may
 * not read the language the page is in right now.
 */

/** The full list, for Settings › Language. */
export function LanguageList() {
  const current = getLocale().code;
  return (
    <div
      role="radiogroup"
      aria-label={t("Language")}
      className="flex flex-col overflow-hidden rounded-2xl border border-tn-border"
    >
      {LOCALES.map((locale, index) => {
        const on = locale.code === current;
        return (
          <button
            key={locale.code}
            type="button"
            role="radio"
            aria-checked={on}
            lang={locale.code}
            onClick={() => {
              if (!on) setLocale(locale.code);
            }}
            className={`flex cursor-pointer items-center justify-between gap-3 border-none bg-transparent px-5 py-4 text-start font-sans text-sm ${
              index < LOCALES.length - 1 ? "border-b border-solid border-tn-border-soft" : ""
            } ${on ? "font-semibold text-tn-ink" : "font-medium text-tn-ink-soft hover:text-tn-ink"}`}
          >
            <span>{locale.label}</span>
            {on ? (
              <svg
                viewBox="0 0 24 24"
                width={18}
                height={18}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-tn-gold"
                aria-hidden
              >
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** The compact switcher, for screens before sign-in. A native select, so a phone shows its own picker. */
export function LanguageSelect({ className = "" }: { className?: string }) {
  return (
    <label
      className={`inline-flex cursor-pointer items-center gap-1.5 font-sans text-[13px] font-medium text-tn-muted-5 hover:text-tn-ink ${className}`}
    >
      <GlobeIcon />
      <span className="sr-only">{t("Language")}</span>
      <select
        value={getLocale().code}
        onChange={(event) => setLocale(event.target.value as LocaleCode)}
        className="cursor-pointer appearance-none border-none bg-transparent p-0 font-sans text-[13px] font-medium text-inherit focus:outline-none"
      >
        {LOCALES.map((locale) => (
          <option key={locale.code} value={locale.code} lang={locale.code}>
            {locale.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function GlobeIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 9h17M3.5 15h17M12 3c-2.4 2.5-3.6 5.5-3.6 9s1.2 6.5 3.6 9M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9" />
    </svg>
  );
}
