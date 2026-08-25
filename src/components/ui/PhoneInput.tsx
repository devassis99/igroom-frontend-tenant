import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { useAnchoredPanel } from "@/components/ui/use-anchored-panel";

interface PhoneInputProps {
  /** Combined "+<dial code> <national number as typed>" string (e.g. "+1 5555550182"), or "" for empty. Same plain-string shape every phone field already sends to the backend — no API change, just a richer way to produce that string. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export interface CountryDef {
  iso2: string;
  name: string;
  dialCode: string;
  /** [min, max] national significant number digit count — a broad-strokes sanity check, not a full numbering-plan validator (that's libphonenumber-js territory, which isn't a dependency here). */
  digits: [number, number];
}

// Covers the countries this account's data has actually touched so far
// (US, Spain/Valencia, Pakistan/Karachi — see TimezonePicker.tsx's users)
// plus every other widely-used market, sorted alphabetically by name.
// Digit ranges are the national significant number length (i.e. excluding
// the country/dial code itself), sourced from each country's public
// numbering plan.
const COUNTRIES: CountryDef[] = [
  { iso2: "DZ", name: "Algeria", dialCode: "213", digits: [9, 9] },
  { iso2: "AR", name: "Argentina", dialCode: "54", digits: [10, 10] },
  { iso2: "AU", name: "Australia", dialCode: "61", digits: [9, 9] },
  { iso2: "BH", name: "Bahrain", dialCode: "973", digits: [8, 8] },
  { iso2: "BD", name: "Bangladesh", dialCode: "880", digits: [10, 10] },
  { iso2: "BR", name: "Brazil", dialCode: "55", digits: [10, 11] },
  { iso2: "CA", name: "Canada", dialCode: "1", digits: [10, 10] },
  { iso2: "CL", name: "Chile", dialCode: "56", digits: [9, 9] },
  { iso2: "CN", name: "China", dialCode: "86", digits: [11, 11] },
  { iso2: "CO", name: "Colombia", dialCode: "57", digits: [10, 10] },
  { iso2: "EG", name: "Egypt", dialCode: "20", digits: [10, 10] },
  { iso2: "FR", name: "France", dialCode: "33", digits: [9, 9] },
  { iso2: "DE", name: "Germany", dialCode: "49", digits: [10, 11] },
  { iso2: "GR", name: "Greece", dialCode: "30", digits: [10, 10] },
  { iso2: "IN", name: "India", dialCode: "91", digits: [10, 10] },
  { iso2: "ID", name: "Indonesia", dialCode: "62", digits: [9, 12] },
  { iso2: "IE", name: "Ireland", dialCode: "353", digits: [9, 9] },
  { iso2: "IL", name: "Israel", dialCode: "972", digits: [8, 9] },
  { iso2: "IT", name: "Italy", dialCode: "39", digits: [9, 10] },
  { iso2: "JP", name: "Japan", dialCode: "81", digits: [10, 10] },
  { iso2: "JO", name: "Jordan", dialCode: "962", digits: [9, 9] },
  { iso2: "KE", name: "Kenya", dialCode: "254", digits: [9, 9] },
  { iso2: "KW", name: "Kuwait", dialCode: "965", digits: [8, 8] },
  { iso2: "LB", name: "Lebanon", dialCode: "961", digits: [7, 8] },
  { iso2: "MY", name: "Malaysia", dialCode: "60", digits: [9, 10] },
  { iso2: "MX", name: "Mexico", dialCode: "52", digits: [10, 10] },
  { iso2: "MA", name: "Morocco", dialCode: "212", digits: [9, 9] },
  { iso2: "NL", name: "Netherlands", dialCode: "31", digits: [9, 9] },
  { iso2: "NZ", name: "New Zealand", dialCode: "64", digits: [8, 9] },
  { iso2: "NG", name: "Nigeria", dialCode: "234", digits: [10, 10] },
  { iso2: "NO", name: "Norway", dialCode: "47", digits: [8, 8] },
  { iso2: "OM", name: "Oman", dialCode: "968", digits: [8, 8] },
  { iso2: "PK", name: "Pakistan", dialCode: "92", digits: [10, 10] },
  { iso2: "PE", name: "Peru", dialCode: "51", digits: [9, 9] },
  { iso2: "PH", name: "Philippines", dialCode: "63", digits: [10, 10] },
  { iso2: "PL", name: "Poland", dialCode: "48", digits: [9, 9] },
  { iso2: "PT", name: "Portugal", dialCode: "351", digits: [9, 9] },
  { iso2: "QA", name: "Qatar", dialCode: "974", digits: [8, 8] },
  { iso2: "RU", name: "Russia", dialCode: "7", digits: [10, 10] },
  { iso2: "SA", name: "Saudi Arabia", dialCode: "966", digits: [9, 9] },
  { iso2: "SG", name: "Singapore", dialCode: "65", digits: [8, 8] },
  { iso2: "ZA", name: "South Africa", dialCode: "27", digits: [9, 9] },
  { iso2: "KR", name: "South Korea", dialCode: "82", digits: [9, 10] },
  { iso2: "ES", name: "Spain", dialCode: "34", digits: [9, 9] },
  { iso2: "SE", name: "Sweden", dialCode: "46", digits: [7, 9] },
  { iso2: "CH", name: "Switzerland", dialCode: "41", digits: [9, 9] },
  { iso2: "TH", name: "Thailand", dialCode: "66", digits: [9, 9] },
  { iso2: "TN", name: "Tunisia", dialCode: "216", digits: [8, 8] },
  { iso2: "TR", name: "Turkey", dialCode: "90", digits: [10, 10] },
  { iso2: "UA", name: "Ukraine", dialCode: "380", digits: [9, 9] },
  { iso2: "AE", name: "United Arab Emirates", dialCode: "971", digits: [9, 9] },
  { iso2: "GB", name: "United Kingdom", dialCode: "44", digits: [10, 10] },
  { iso2: "US", name: "United States", dialCode: "1", digits: [10, 10] },
  { iso2: "VN", name: "Vietnam", dialCode: "84", digits: [9, 10] },
];

const DEFAULT_COUNTRY = COUNTRIES.find((c) => c.iso2 === "US")!;
// Longest dial code first, so "+1..." doesn't shadow-match a
// three-digit code that happens to start with the same leading digit.
// DEFAULT_COUNTRY wins any tie: the US and Canada both use "+1", and a
// plain length sort left Canada first, so every saved US number came back
// from the database showing a Canadian flag.
const COUNTRIES_BY_DIAL_CODE_DESC = [...COUNTRIES].sort((a, b) => {
  if (b.dialCode.length !== a.dialCode.length) return b.dialCode.length - a.dialCode.length;
  if (a.iso2 === DEFAULT_COUNTRY.iso2) return -1;
  if (b.iso2 === DEFAULT_COUNTRY.iso2) return 1;
  return 0;
});

function flagEmoji(iso2: string): string {
  return String.fromCodePoint(
    ...iso2.split("").map((ch) => 0x1f1e6 + (ch.toUpperCase().charCodeAt(0) - 65)),
  );
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/**
 * Strips the invisible characters that ride along with a number copied out
 * of a contacts app or a right-to-left document, and folds the full-width
 * "\uFF0B" onto ASCII "+". Without this, a value that *looks* international
 * fails the startsWith("+") test below and is treated as a national number
 * — dial code and all, which is how a country code ends up displayed inside
 * the national box.
 */
function normalizePhoneText(value: string): string {
  return value
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
    .replace(/^\uFF0B/, "+")
    .trim();
}

/** Drops the first `count` digits along with any punctuation among them, keeping the rest exactly as the user wrote it. */
function dropLeadingDigits(text: string, count: number): string {
  let dropped = 0;
  let i = 0;
  for (; i < text.length && dropped < count; i++) {
    if (/\d/.test(text[i]!)) dropped++;
  }
  return text.slice(i).trim();
}

/**
 * A number written with its country code but no "+" ("1 (343) 631-8566").
 * Only strips when the string is too long to be a national number already
 * AND the leftover is exactly the length that country expects — so a
 * genuine national number that merely starts with the dial-code digit is
 * left alone.
 */
function stripUnprefixedDialCode(country: CountryDef, text: string): string {
  const digits = digitsOnly(text);
  const [min, max] = country.digits;
  if (digits.length >= min && digits.length <= max) return text;
  if (!digits.startsWith(country.dialCode)) return text;
  const remaining = digits.length - country.dialCode.length;
  if (remaining < min || remaining > max) return text;
  return dropLeadingDigits(text, country.dialCode.length);
}

/**
 * The national-number grouping each country writes its own numbers in.
 *
 * "#" is a digit slot; every other character is a literal the field
 * inserts as you type. Listed shortest-form first where a country has more
 * than one length (Brazil's 10- and 11-digit forms, say) — pickMask takes
 * the first one that can still hold what has been typed.
 *
 * These are display conventions, not validation. isPhoneValid still
 * decides acceptability by digit count, and formatNational keeps any
 * digits a mask can't hold rather than dropping them — so a grouping
 * that's wrong for some region is a cosmetic bug, never lost data.
 */
const NATIONAL_MASKS: Record<string, string[]> = {
  DZ: ["### ## ## ##"],
  AR: ["## #### ####"],
  AU: ["### ### ###"],
  BH: ["#### ####"],
  BD: ["####-######"],
  BR: ["(##) ####-####", "(##) #####-####"],
  CA: ["(###) ###-####"],
  CL: ["# #### ####"],
  CN: ["### #### ####"],
  CO: ["### ### ####"],
  EG: ["### ### ####"],
  FR: ["# ## ## ## ##"],
  DE: ["### #######", "### ########"],
  GR: ["### ### ####"],
  IN: ["##### #####"],
  ID: ["###-####-##", "###-####-###", "###-####-####", "###-####-#####"],
  IE: ["## ### ####"],
  IL: ["#-###-####", "##-###-####"],
  IT: ["### ### ###", "### ### ####"],
  JP: ["##-####-####"],
  JO: ["# #### ####"],
  KE: ["### ######"],
  KW: ["#### ####"],
  LB: ["# ### ###", "## ### ###"],
  MY: ["##-### ####", "##-#### ####"],
  MX: ["## #### ####"],
  MA: ["### ## ## ##"],
  NL: ["# ## ## ## ##"],
  NZ: ["## ### ###", "## ### ####"],
  NG: ["### ### ####"],
  NO: ["### ## ###"],
  OM: ["#### ####"],
  PK: ["### #######"],
  PE: ["### ### ###"],
  PH: ["### ### ####"],
  PL: ["### ### ###"],
  PT: ["### ### ###"],
  QA: ["#### ####"],
  RU: ["### ###-##-##"],
  SA: ["## ### ####"],
  SG: ["#### ####"],
  ZA: ["## ### ####"],
  KR: ["##-###-####", "##-####-####"],
  ES: ["### ## ## ##"],
  SE: ["##-### ## #", "##-### ## ##", "##-### ## ###"],
  CH: ["## ### ## ##"],
  TH: ["##-###-####"],
  TN: ["## ### ###"],
  TR: ["### ### ## ##"],
  UA: ["## ### ## ##"],
  AE: ["## ### ####"],
  GB: ["#### ######"],
  US: ["(###) ###-####"],
  VN: ["### ### ###", "### ### ####"],
};

function maskCapacity(mask: string): number {
  return (mask.match(/#/g) ?? []).length;
}

/** Grouping for a country with no mask of its own, so the field never falls back to an unbroken run of digits. */
function fallbackMask(count: number): string {
  if (count <= 6) return "### ###";
  if (count <= 8) return "#### ####";
  if (count <= 9) return "### ### ###";
  return "### ### ####";
}

function pickMask(iso2: string, digitCount: number): string {
  const masks = NATIONAL_MASKS[iso2];
  if (!masks || masks.length === 0) return fallbackMask(digitCount);
  return masks.find((m) => maskCapacity(m) >= digitCount) ?? masks[masks.length - 1]!;
}

/**
 * Lays `digits` into the country's mask, stopping where the digits run out
 * so a half-typed number shows neither empty placeholders nor a trailing
 * separator. Digits past the mask's capacity are appended rather than
 * discarded — the field must never silently eat what someone typed, even
 * when the result is going to fail validation anyway.
 */
export function formatNational(iso2: string, digits: string): string {
  if (!digits) return "";
  const mask = pickMask(iso2, digits.length);
  let out = "";
  let d = 0;
  for (const ch of mask) {
    if (d >= digits.length) break;
    if (ch === "#") {
      out += digits[d++];
    } else {
      out += ch;
    }
  }
  if (d < digits.length) out += digits.slice(d);
  return out;
}

/** How many digits sit at or before `caret` — the one position that survives reformatting, since separators move around. */
export function digitsBeforeCaret(text: string, caret: number): number {
  return digitsOnly(text.slice(0, caret)).length;
}

/** The offset in `formatted` just after its `n`th digit. */
export function caretAfterDigit(formatted: string, n: number): number {
  if (n <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]!)) {
      seen++;
      if (seen === n) return i + 1;
    }
  }
  return formatted.length;
}

export interface ParsedPhone {
  country: CountryDef;
  national: string;
  /** True when the value carried an explicit "+<known dial code>", so the country is the value's own rather than merely the default. */
  hadExplicitCode: boolean;
}

/**
 * Splits a stored "+<dial code> <national>" value into its country and the
 * raw national text — falling back to DEFAULT_COUNTRY when there's no
 * recognisable "+<code>" prefix (legacy data, or a fresh empty field).
 *
 * Peels repeatedly rather than once. One pass is enough for clean data, but
 * combine() used to write "+1 +1 (343) 631-8566" whenever a complete number
 * reached the national box, so values shaped like that are already stored.
 * A single pass would hand the inner "+1" straight back to the input and
 * reproduce the bug on every edit. The outermost code wins — that is the
 * one the country picker last set.
 */
export function parsePhoneValue(
  value: string,
  /** Which country's numbering plan to assume for a value with no "+" prefix. The picker's current selection when there is one — otherwise an 11-digit Chinese number would be read against the US plan and lose its leading 1. */
  fallbackCountry: CountryDef = DEFAULT_COUNTRY,
): ParsedPhone {
  let rest = normalizePhoneText(value);
  let country: CountryDef | null = null;

  while (rest.startsWith("+")) {
    const withoutPlus = rest.slice(1).trim();
    const match = COUNTRIES_BY_DIAL_CODE_DESC.find((c) => withoutPlus.startsWith(c.dialCode));
    if (!match) {
      // A "+" carrying a dial code we don't list. Keep the digits but drop
      // the "+": leaving it would put a country code back into the national
      // box, and combine() would emit "+1 +999 ..." on the next keystroke.
      return {
        country: country ?? fallbackCountry,
        national: withoutPlus,
        hadExplicitCode: country !== null,
      };
    }
    country ??= match;
    rest = dropLeadingDigits(withoutPlus, match.dialCode.length);
  }

  if (country) return { country, national: rest, hadExplicitCode: true };
  return {
    country: fallbackCountry,
    national: stripUnprefixedDialCode(fallbackCountry, rest),
    hadExplicitCode: false,
  };
}

export function combine(country: CountryDef, national: string): string {
  // Re-parse the national box before joining. Pasting a complete number
  // into it is the obvious thing for someone to do, and without this the
  // stored value becomes "+1 +1 (343) 631-8566" — which is exactly how the
  // duplicated code got on screen.
  const cleaned = parsePhoneValue(national, country).national;
  if (!cleaned.trim()) return "";
  return `+${country.dialCode} ${cleaned.trim()}`;
}

/** true for "" (phone is optional everywhere it's used) or a national number whose digit count falls in the selected country's expected range — a sanity check, not full numbering-plan validation. */
export function isPhoneValid(value: string): boolean {
  const { country, national } = parsePhoneValue(value);
  if (!national.trim()) return true;
  const count = digitsOnly(national).length;
  return count >= country.digits[0] && count <= country.digits[1];
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/**
 * Every phone field in the app (booking customer, walk-in customer,
 * account customer, staff member, location, business signup) shares this
 * one control: a country dial-code picker plus the national number, with
 * a basic per-country digit-count check surfaced inline. No new
 * dependency (e.g. libphonenumber-js) — this environment can't install
 * one into the real repo (see chat), so validation here is a length
 * sanity check against each country's numbering plan rather than full
 * carrier-grade validation.
 *
 * The combined value stays a single plain string ("+<dial code>
 * <national>"), same shape every phone field already stored — so no
 * backend change was needed to adopt this.
 */
export function PhoneInput({
  value,
  onChange,
  placeholder = "555 555 0182",
  className = "",
}: PhoneInputProps) {
  const parsedValue = parsePhoneValue(value);
  const national = formatNational(parsedValue.country.iso2, digitsOnly(parsedValue.national));
  // The selected country is tracked as its own piece of state rather than
  // re-derived from `value` on every render. Deriving it purely from
  // `value` broke picking a country while the number was still empty:
  // combine() below returns "" for an empty national number (so the
  // field round-trips through the parent's "phone.trim() || undefined"
  // as truly empty rather than a bogus "+92 "), and parsePhoneValue("")
  // has no dial code to recover — every keystroke would reset the picker
  // back to the default country. `lastEmitted` distinguishes "value
  // changed because we called onChange" (skip resync, our local country
  // is already right) from "value changed some other way" (e.g. a parent
  // prefilling an existing phone number once its own data loads — resync
  // from the new value so editing an existing +92 number shows Pakistan).
  const [country, setCountry] = useState<CountryDef>(() => parsePhoneValue(value).country);
  const lastEmitted = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Where to put the caret once the reformatted value has rendered. The
  // value round-trips through the parent, so the DOM node's own caret is
  // long gone by then — without this, every keystroke in the middle of a
  // number would fling the caret to the end.
  const pendingCaret = useRef<number | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const position = useAnchoredPanel(open, anchorRef, { width: 280, minHeight: 260 });

  useEffect(() => {
    if (value === lastEmitted.current) return;
    setCountry(parsePhoneValue(value).country);
  }, [value]);

  // Deliberately has no dependency array: it must run after whichever
  // render actually applied the new value, and only does anything when a
  // caret position is waiting.
  useLayoutEffect(() => {
    if (pendingCaret.current === null || !inputRef.current) return;
    const at = pendingCaret.current;
    pendingCaret.current = null;
    inputRef.current.setSelectionRange(at, at);
  });

  useEffect(() => {
    if (open) {
      setQuery("");
      searchInputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onResize() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  function selectCountry(next: CountryDef) {
    setCountry(next);
    // Re-group the digits under the new country's mask — the text in the box
    // is currently laid out for the old one, and leaving it would show a
    // French number wearing US parentheses.
    const combined = combine(next, formatNational(next.iso2, digitsOnly(national)));
    lastEmitted.current = combined;
    onChange(combined);
    setOpen(false);
  }

  function handleNationalChange(event: ChangeEvent<HTMLInputElement>) {
    setTouched(true);
    const raw = event.target.value;
    const caret = event.target.selectionStart ?? raw.length;
    const deleting = raw.length < national.length;

    // Pasting a complete international number into the box moves the picker
    // to match it, rather than silently filing those digits under whatever
    // country happened to be selected. combine() strips the pasted code
    // either way; this is what stops "+92 300..." being saved as a US number.
    const parsed = parsePhoneValue(raw, country);
    const nextCountry = parsed.hadExplicitCode ? parsed.country : country;
    if (parsed.hadExplicitCode && parsed.country.iso2 !== country.iso2) {
      setCountry(parsed.country);
    }

    let digits = digitsOnly(parsed.national);
    let digitCaret = digitsBeforeCaret(raw, caret);

    // Backspacing over a separator deletes no digit, so the mask would put
    // that separator straight back and the caret would sit there unable to
    // move. Take the digit in front of it instead, which is what the
    // keystroke was plainly for.
    if (deleting && digits.length === digitsOnly(national).length && digitCaret > 0) {
      digits = digits.slice(0, digitCaret - 1) + digits.slice(digitCaret);
      digitCaret -= 1;
    }

    const formatted = formatNational(nextCountry.iso2, digits);
    pendingCaret.current = caretAfterDigit(formatted, digitCaret);

    const combined = combine(nextCountry, formatted);
    lastEmitted.current = combined;
    onChange(combined);
  }

  const filteredCountries = query.trim()
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(query.trim().toLowerCase()) ||
          c.dialCode.includes(query.trim()),
      )
    : COUNTRIES;

  const showError = touched && national.trim() !== "" && !isPhoneValid(value);

  return (
    <div>
      <div
        className={`flex items-stretch rounded-xl border bg-tn-surface focus-within:border-2 focus-within:border-tn-gold ${
          showError ? "border-tn-danger" : "border-tn-input-border"
        } ${className}`}
      >
        <button
          ref={anchorRef}
          type="button"
          aria-label="Country code"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-l-xl border-none border-r border-r-tn-border-soft bg-transparent py-3 pl-3 pr-2 font-sans text-sm text-tn-ink-soft"
        >
          <span aria-hidden>{flagEmoji(country.iso2)}</span>
          <span>+{country.dialCode}</span>
          <ChevronIcon open={open} />
        </button>
        <input
          ref={inputRef}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={national}
          onChange={handleNationalChange}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          className="w-full min-w-0 flex-1 rounded-r-xl border-none bg-transparent px-3 py-3 font-sans text-sm text-tn-ink outline-none placeholder:text-tn-placeholder"
        />
      </div>
      {showError && (
        <p className="m-0 mt-1 font-sans text-xs text-tn-danger">
          Doesn&rsquo;t look like a valid {country.name} number ({country.digits[0]}
          {country.digits[1] !== country.digits[0] ? `–${country.digits[1]}` : ""} digits).
        </p>
      )}

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            aria-label="Country code"
            className="fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-tn-border bg-tn-surface"
            style={{
              top: position.top,
              bottom: position.bottom,
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
              boxShadow: "0 20px 45px -15px rgba(20,15,5,0.35)",
            }}
          >
            <div className="flex-none border-b border-tn-border-soft px-4 py-2.5">
              <div className="flex items-center gap-2 rounded-lg bg-tn-page px-3 py-2">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search country or code"
                  className="w-full border-none bg-transparent font-sans text-[13px] text-tn-ink outline-none placeholder:text-tn-muted-5"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto py-1.5">
              {filteredCountries.map((c) => (
                <button
                  key={c.iso2}
                  type="button"
                  onClick={() => selectCountry(c)}
                  className="flex w-full cursor-pointer items-center gap-2.5 border-none bg-transparent px-4 py-2.5 text-left font-sans text-[13px] font-medium text-tn-ink-soft hover:bg-tn-page"
                >
                  <span aria-hidden>{flagEmoji(c.iso2)}</span>
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="shrink-0 text-tn-muted-5">+{c.dialCode}</span>
                </button>
              ))}

              {filteredCountries.length === 0 && (
                <p className="m-0 px-4 py-3 font-sans text-[13px] text-tn-muted-5">
                  No countries match &ldquo;{query}&rdquo;
                </p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export default PhoneInput;
