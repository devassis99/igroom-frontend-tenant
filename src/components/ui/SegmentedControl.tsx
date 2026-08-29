import { useCallback, useLayoutEffect, useRef } from "react";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * The pill-shaped toggle used for List/Board, Day/Week/Month, and the
 * billing-cycle tabs.
 *
 * The selected state is a single thumb that slides and resizes between
 * options, rather than a background colour hopping from one button to
 * the next. The hop gives no sense that the options are positions on one
 * track — which is the only idea this control exists to express — and it
 * makes a view switch feel like a page replacement rather than a move.
 *
 * The thumb's position is measured from the real button rather than
 * computed as a fraction of the width, so options of different lengths
 * ("List" and "Board") work without forcing every segment to equal size.
 * That measurement is written straight to the element's style in a
 * layout effect: routing it through React state would mean a second
 * render pass on every click, in a component whose whole job is to feel
 * immediate.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const buttonsRef = useRef(new Map<T, HTMLButtonElement>());
  /**
   * The first measurement positions the thumb; it must not animate there
   * from x=0, which would look like the control assembling itself on
   * every mount. Transitions are switched on only once it has somewhere
   * to have come from.
   */
  const hasPositioned = useRef(false);

  const position = useCallback(() => {
    const button = buttonsRef.current.get(value);
    const thumb = thumbRef.current;
    if (!button || !thumb) return;
    thumb.style.transform = `translateX(${button.offsetLeft}px)`;
    thumb.style.width = `${button.offsetWidth}px`;
    if (!hasPositioned.current) {
      // Two frames: one for the style above to be committed, one for the
      // browser to have painted it, before the transition can attach to
      // anything. Adding the class in the same frame lets the initial
      // placement animate.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          thumb.classList.add("tn-segmented-thumb");
        });
      });
      hasPositioned.current = true;
    }
  }, [value]);

  useLayoutEffect(() => {
    position();
  }, [position, options]);

  /**
   * Re-measure when the control's own box changes — a font finishing
   * loading, the header wrapping at a narrow width, a sidebar collapsing.
   * Without this the thumb stays where it was and drifts off its button.
   */
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => position());
    observer.observe(track);
    return () => observer.disconnect();
  }, [position]);

  return (
    <div ref={trackRef} className="relative flex gap-0.5 rounded-full bg-tn-page p-[3px]">
      {/*
        Behind the labels, and inert: the buttons below carry every
        interaction and the accessible state, so this is decoration and is
        hidden from assistive technology.
      */}
      <span
        ref={thumbRef}
        aria-hidden
        className="pointer-events-none absolute top-[3px] bottom-[3px] left-0 rounded-full bg-tn-dark"
      />
      {options.map((option) => (
        <button
          key={option.value}
          ref={(node) => {
            if (node) buttonsRef.current.set(option.value, node);
            else buttonsRef.current.delete(option.value);
          }}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={`relative rounded-full px-3.5 py-1.5 font-sans text-xs transition-colors duration-200 ${
            option.value === value
              ? "font-semibold text-tn-on-dark"
              : "font-medium text-tn-muted-5 hover:text-tn-ink-soft"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default SegmentedControl;
