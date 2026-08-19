import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

interface PhoneInputProps {
  /** Combined "+<dial code> <national number as typed>" string (e.g. "+1 5555550182"), or "" for empty. Same plain-string shape every phone field already sends to the backend — no API change, just a richer way to produce that string. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

interface CountryDef {
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
const COUNTRIES_BY_DIAL_CODE_DESC = [...COUNTRIES].sort(
  (a, b) => b.dialCode.length - a.dialCode.length,
);

const GAP = 6;

function flagEmoji(iso2: string): string {
  return String.fromCodePoint(
    ...iso2.split("").map((ch) => 0x1f1e6 + (ch.toUpperCase().charCodeAt(0) - 65)),
  );
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** Splits a stored "+<dial code> <national>" value into its country + raw national text — falls back to DEFAULT_COUNTRY for a value with no recognizable "+<code>" prefix (legacy data saved before this component existed, or a fresh empty field). */
export function parsePhoneValue(value: string): { country: CountryDef; national: string } {
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) {
    const rest = trimmed.slice(1);
    const match = COUNTRIES_BY_DIAL_CODE_DESC.find((c) => rest.startsWith(c.dialCode));
    if (match) {
      return { country: match, national: rest.slice(match.dialCode.length).trim() };
    }
  }
  return { country: DEFAULT_COUNTRY, national: trimmed };
}

function combine(country: CountryDef, national: string): string {
  if (!national.trim()) return "";
  return `+${country.dialCode} ${national.trim()}`;
}

/** true for "" (phone is optional everywhere it's used) or a national number whose digit count falls in the selected country's expected range — a sanity check, not full numbering-plan validation. */
export function isPhoneValid(value: string): boolean {
  const { country, national } = parsePhoneValue(value);
  if (!national.trim()) return true;
  const count = digitsOnly(national).length;
  return count >= country.digits[0] && count <= country.digits[1];
}

function useAnchoredPosition(open: boolean, anchorRef: RefObject<HTMLElement | null>) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setPosition(null);
      return;
    }
    const rect = anchorRef.current.getBoundingClientRect();
    setPosition({ top: rect.bottom + GAP, left: rect.left });
  }, [open, anchorRef]);

  return position;
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
  const national = parsePhoneValue(value).national;
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
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const position = useAnchoredPosition(open, anchorRef);

  useEffect(() => {
    if (value === lastEmitted.current) return;
    setCountry(parsePhoneValue(value).country);
  }, [value]);

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
    const combined = combine(next, national);
    lastEmitted.current = combined;
    onChange(combined);
    setOpen(false);
  }

  function handleNationalChange(nextNational: string) {
    setTouched(true);
    const combined = combine(country, nextNational);
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
          type="tel"
          value={national}
          onChange={(e) => handleNationalChange(e.target.value)}
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
            className="fixed z-50 overflow-hidden rounded-2xl border border-tn-border bg-tn-surface"
            style={{
              top: position.top,
              left: position.left,
              width: 280,
              boxShadow: "0 20px 45px -15px rgba(20,15,5,0.35)",
            }}
          >
            <div className="border-b border-tn-border-soft px-4 py-2.5">
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

            <div className="max-h-64 overflow-y-auto py-1.5">
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
