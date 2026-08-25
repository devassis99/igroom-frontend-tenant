import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formInputClass } from "@/components/ui/FormField";
import { useAuthStore } from "@/auth/auth-store";
import { retrievePlace, searchPlaces, type GeocodeResult } from "@/lib/locations-api";

interface MapSearchFieldProps {
  /** The only output: a resolved place, used for its coordinates. */
  onSelect: (result: GeocodeResult) => void;
  /** Current pin, if any — biases results toward where the map already is. */
  proximity?: { latitude: number; longitude: number };
  disabled?: boolean;
  placeholder?: string;
}

/** Below this, results are too broad to be worth a request. */
const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 300;

function newSessionToken(): string {
  return crypto.randomUUID();
}

/**
 * Searches the map. Deliberately NOT the address field.
 *
 * These were one control at first, and that was the bug: the same input
 * both stored the shop's address and drove the geocoder, so picking a
 * suggestion or nudging the pin overwrote whatever the owner had written
 * with the provider's phrasing. This field owns its query internally, is
 * never persisted, and its only output is coordinates.
 *
 * Backed by Mapbox Search Box rather than the Geocoding API, which only
 * knows postal addresses and administrative areas — searching "DHA Rahbar
 * Lahore", a housing society nobody has a street address for, matched
 * nothing there and fell back to fuzzy-matching "lahore" worldwide.
 * Search Box indexes POIs and local names, which is what owners actually
 * type when locating their own shop.
 */
export function MapSearchField({
  onSelect,
  proximity,
  disabled,
  placeholder,
}: MapSearchFieldProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * One session spans a whole type-ahead — every keystroke plus the final
   * retrieve — and Mapbox bills per session, not per request. Retired
   * after each successful pick so the next search starts a new one.
   *
   * State rather than a ref because the query key reads it: rotating the
   * session has to invalidate the cached suggestions belonging to the old
   * one, and a ref change doesn't re-key anything.
   */
  const [session, setSession] = useState(newSessionToken);

  // Debounce: `text` updates per keystroke, `query` (what gets fetched)
  // settles only once typing pauses.
  useEffect(() => {
    const timeout = window.setTimeout(() => setQuery(text.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [text]);

  const suggestionsQuery = useQuery({
    // `session` is in the key deliberately, and it is not redundant.
    // Search Box ids are only resolvable by the session that produced
    // them, and the session is retired after every pick — so a cached
    // list from an earlier session would hand back ids that retrieve()
    // then rejects. Symptom: clicking a suggestion appears to do nothing
    // and the query stays in the box. Keying on the session means a
    // retired one's results are never reused.
    queryKey: ["place-search", session, query, proximity?.latitude, proximity?.longitude],
    queryFn: () => searchPlaces(accessToken ?? "", query, session, proximity),
    enabled: !!accessToken && open && query.length >= MIN_QUERY_LENGTH,
    staleTime: 5 * 60 * 1000,
  });
  const suggestions = suggestionsQuery.data?.results ?? [];

  // Pointerdown, not click, so the list is gone before a click on the page
  // behind it lands.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  async function choose(id: string) {
    setResolving(true);
    setError(null);
    try {
      const result = await retrievePlace(accessToken ?? "", id, session);
      onSelect(result);
      setOpen(false);
      // Cleared on purpose: this is a search box, not a value. Leaving the
      // last query in it would read as saved data — and worse, the next
      // keystroke would search that formatted display string ("DHA Rahbar
      // — Lahore, Punjab"), which matches far less well than what the
      // owner originally typed.
      setText("");
      setQuery("");
      setSession(newSessionToken());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't resolve that place.");
    } finally {
      setResolving(false);
    }
  }

  const showList = open && query.length >= MIN_QUERY_LENGTH;

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={text}
        disabled={disabled || resolving}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          // A stale failure must not sit over a fresh set of results.
          if (error) setError(null);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder ?? "Search a place, area or address to move the pin"}
        autoComplete="off"
        className={`${formInputClass} w-full`}
      />

      {showList && (
        <div className="absolute top-full right-0 left-0 z-10 mt-1 overflow-hidden rounded-xl border border-tn-input-border bg-tn-surface shadow-lg">
          {(suggestionsQuery.isPending || resolving) && (
            <p className="m-0 px-3.5 py-3 font-sans text-sm text-tn-muted-5">
              {resolving ? "Locating…" : "Searching…"}
            </p>
          )}
          {(suggestionsQuery.isError || error) && (
            <p className="m-0 px-3.5 py-3 font-sans text-sm text-tn-danger">
              {error ?? "Search failed — drop the pin on the map by hand."}
            </p>
          )}
          {suggestionsQuery.isSuccess && !resolving && suggestions.length === 0 && (
            <p className="m-0 px-3.5 py-3 font-sans text-sm text-tn-muted-5">
              No matches. Keep typing, or drop the pin on the map.
            </p>
          )}
          {!resolving &&
            suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => void choose(suggestion.id)}
                className="block w-full cursor-pointer border-none bg-transparent px-3.5 py-2.5 text-left font-sans text-sm text-tn-ink hover:bg-tn-page"
              >
                {suggestion.displayName}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

export default MapSearchField;
