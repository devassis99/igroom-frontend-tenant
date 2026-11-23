/**
 * Languages.
 *
 * English is the source language. Every piece of copy is written in
 * English in the code, wrapped in `t("…")`, and that English text *is*
 * the lookup key: `locales/pt-BR.json` maps "Book now" to "Reservar
 * agora". A string with no translation yet falls back to the English, so
 * a new screen never shows a blank or a raw key — it just shows English
 * until the dictionaries catch up (`node scripts/i18n-missing.mjs` lists
 * what's missing).
 *
 * Values go in as `{{name}}` placeholders, never by gluing strings
 * together, because word order changes between languages:
 *
 *   t("Open until {{time}}", { time: formatTime(closesAt) })
 *
 * The chosen language is applied once, before the app renders (main.tsx
 * awaits `initI18n`), and changing it reloads the page. That keeps `t`
 * a plain function: it works in components, helpers and module-level
 * constants alike, with no provider or hook, and nothing on screen can be
 * left in the previous language.
 */

export const LOCALES = [
  { code: "en", label: "English", intl: "en-US", dir: "ltr" },
  { code: "pt-BR", label: "Português (Brasil)", intl: "pt-BR", dir: "ltr" },
  { code: "es", label: "Español", intl: "es-419", dir: "ltr" },
  { code: "fr", label: "Français", intl: "fr-FR", dir: "ltr" },
  { code: "ar", label: "العربية", intl: "ar-u-nu-latn", dir: "rtl" },
] as const;

export type Locale = (typeof LOCALES)[number];
export type LocaleCode = Locale["code"];

type Messages = Record<string, string>;

/** One chunk per language, so a visitor downloads only their own. */
const DICTIONARIES: Record<Exclude<LocaleCode, "en">, () => Promise<{ default: Messages }>> = {
  "pt-BR": () => import("./locales/pt-BR.json"),
  es: () => import("./locales/es.json"),
  fr: () => import("./locales/fr.json"),
  ar: () => import("./locales/ar.json"),
};

const STORAGE_KEY = "igroom-tenant-locale";

let current: Locale = LOCALES[0];
let messages: Messages = {};

function find(code: string | null | undefined): Locale | undefined {
  if (!code) return undefined;
  const lower = code.toLowerCase();
  return (
    LOCALES.find((locale) => locale.code.toLowerCase() === lower) ??
    // "pt", "pt-PT", "es-CO", "fr-CA", "ar-SA" → the one language we have for each.
    LOCALES.find((locale) => locale.code.split("-")[0] === lower.split("-")[0])
  );
}

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** The saved choice, else the browser's own languages in order, else English. */
export function detectLocale(): Locale {
  const stored = find(readStored());
  if (stored) return stored;
  const preferred =
    typeof navigator === "undefined" ? [] : (navigator.languages ?? [navigator.language]);
  for (const tag of preferred) {
    const match = find(tag);
    if (match) return match;
  }
  return LOCALES[0];
}

/**
 * Load the visitor's language and set `<html lang dir>`. Never throws: a
 * dictionary that fails to load (offline, a stale deploy) leaves the app
 * in English rather than not starting.
 */
export async function initI18n(): Promise<void> {
  const locale = detectLocale();
  if (locale.code !== "en") {
    try {
      messages = (await DICTIONARIES[locale.code]()).default;
      current = locale;
    } catch {
      messages = {};
      current = LOCALES[0];
    }
  }
  document.documentElement.lang = current.code;
  document.documentElement.dir = current.dir;
}

/**
 * Translate. `text` is the English copy; `values` fill its `{{name}}`
 * placeholders. Unused values are ignored, so a translation is free to
 * drop one English needs (a plural "s", say).
 */
export function t(
  text: string,
  values?: Record<string, string | number | boolean | null | undefined>,
): string {
  const template = messages[text] || text;
  if (!values) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) => {
    if (!(name in values)) return match;
    const value = values[name];
    // Like React: null, undefined and booleans render as nothing.
    return value === null || value === undefined || typeof value === "boolean" ? "" : String(value);
  });
}

export function getLocale(): Locale {
  return current;
}

/** The BCP 47 tag for `Intl` / `toLocaleString` — dates, times, prices and numbers. */
export function intlLocale(): string {
  return current.intl;
}

export function isRtl(): boolean {
  return current.dir === "rtl";
}

/** Save the choice and reload into it. */
export function setLocale(code: LocaleCode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Private mode with storage off: the reload falls back to detection.
  }
  window.location.reload();
}
