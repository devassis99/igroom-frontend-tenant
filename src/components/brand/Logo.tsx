/**
 * The groomee logo — the editorial-serif wordmark with its ending in a
 * second colour (so the name teaches its own pronunciation), and the
 * italic "g" app mark. One copy of this file lives in each of the three
 * web apps; keep them identical.
 *
 * The wordmark is the one place a serif survives the switch to Inter:
 * Playfair Display bold and bold italic, loaded in index.html for just
 * the five letters it uses (g, r, o, m, e). The mark is a drawn path,
 * not text, so it looks the same before any font loads and works as the
 * favicon (public/favicon.svg is the same drawing).
 */

/** The italic "g", from Playfair Display Bold Italic, centred in a 64×64 box. */
const G_PATH =
  "M33 30.81 35.28 30.57Q33.34 31.41 31.9 32.13Q30.47 32.85 29.67 33.42Q28.88 33.99 28.88 34.53Q28.88 34.98 29.45 35.3Q30.02 35.63 31.11 35.97L35.28 37.36Q36.72 37.81 38.01 38.48Q39.3 39.15 40.11 40.16Q40.93 41.18 40.93 42.72Q40.93 44.55 39.74 46.14Q38.55 47.73 36.44 48.95Q34.34 50.16 31.63 50.83Q28.93 51.5 25.85 51.5Q23.32 51.5 21.29 51.03Q19.25 50.56 18.04 49.71Q16.82 48.87 16.82 47.73Q16.82 46.79 17.67 45.99Q18.51 45.2 19.85 44.63Q21.19 44.06 22.78 43.69Q24.36 43.31 25.9 43.17L26.1 43.91Q24.41 44.85 23.72 45.84Q23.02 46.84 23.02 47.83Q23.02 49.22 24.09 49.94Q25.16 50.66 26.94 50.66Q28.28 50.66 29.8 50.26Q31.31 49.86 32.6 49.14Q33.89 48.42 34.68 47.46Q35.48 46.49 35.48 45.4Q35.48 44.51 34.78 44.16Q34.09 43.81 32.9 43.46L25.85 41.43Q24.61 41.08 23.74 40.26Q22.88 39.45 22.88 38.2Q22.88 36.82 24.04 35.67Q25.21 34.53 27.49 33.37Q29.77 32.2 33 30.81ZM35.13 16.63Q34.24 16.63 33.47 17.32Q32.7 18.01 32.13 19.2Q31.56 20.4 31.21 21.83Q30.86 23.27 30.69 24.76Q30.52 26.25 30.52 27.54Q30.52 29.18 30.94 29.82Q31.36 30.47 32.1 30.47Q33.34 30.47 34.21 29.45Q35.08 28.43 35.65 26.82Q36.22 25.21 36.47 23.35Q36.72 21.49 36.72 19.75Q36.72 18.46 36.42 17.54Q36.12 16.63 35.13 16.63ZM36.02 15.73Q39.25 15.73 41.38 17.05Q43.51 18.36 43.51 21.34Q43.51 23.72 42 26.03Q40.49 28.33 37.76 29.85Q35.03 31.36 31.26 31.36Q28.08 31.36 25.95 30.02Q23.82 28.68 23.82 25.8Q23.82 24.17 24.59 22.4Q25.36 20.64 26.87 19.13Q28.38 17.62 30.66 16.67Q32.95 15.73 36.02 15.73ZM39.89 18.31 38.95 17.96Q39.69 16.03 41.36 14.77Q43.02 13.5 44.95 13.5Q46.49 13.5 47.33 14.34Q48.18 15.19 48.18 16.67Q48.18 18.06 47.43 18.81Q46.69 19.55 45.84 19.55Q45.05 19.55 44.33 18.96Q43.61 18.36 43.41 17.12Q43.22 15.88 44.01 14L44.41 14.24Q42.52 14.94 41.58 15.86Q40.64 16.77 39.89 18.31Z";

/**
 * "groom" in the ink colour, "ee" in italic clay.
 *
 * `onDark` swaps to the versions drawn for dark backgrounds. Size it with
 * a font-size class (`text-[22px]` …) — it inherits like text.
 */
export function Wordmark({
  onDark = false,
  className = "",
}: {
  onDark?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-baseline font-brand leading-none font-bold tracking-[-0.01em] ${className}`}
    >
      {/* Read as one word, not "groom" then "ee". */}
      <span className="sr-only">groomee</span>
      <span aria-hidden className={onDark ? "text-brand-paper" : "text-brand-ink"}>
        groom
      </span>
      <span aria-hidden className={`italic ${onDark ? "text-brand-clay-soft" : "text-brand-clay"}`}>
        ee
      </span>
    </span>
  );
}

/** The app mark: a clay rounded square with the cream italic "g". */
export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      // Decorative: it always sits beside the wordmark or the shop's name.
      aria-hidden="true"
      focusable="false"
      className={`flex-none ${className}`}
    >
      <rect width="64" height="64" rx="14" fill="#A75B3C" />
      <path fill="#F9F0E5" d={G_PATH} />
    </svg>
  );
}

export default Wordmark;
