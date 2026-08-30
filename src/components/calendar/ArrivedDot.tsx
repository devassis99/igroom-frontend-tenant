/**
 * "This client is in the building."
 *
 * A dot rather than a pill because it has to fit inside a calendar block
 * that is sometimes two lines of 11px text in a 30-minute slot — and
 * because the barber glancing at the grid is asking one binary question
 * ("who's here?"), not reading a label. The arrival time is in the
 * tooltip and in the screen-reader text for anyone who wants it, and the
 * appointment modal shows it as a proper pill.
 */
export function ArrivedDot({ checkedInAt }: { checkedInAt: string | null }) {
  if (!checkedInAt) return null;
  const label = `Arrived ${new Date(checkedInAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}`;
  return (
    <span
      title={label}
      className="mr-1 inline-block h-[7px] w-[7px] shrink-0 rounded-full bg-tn-success align-middle"
    >
      <span className="sr-only">{label}</span>
    </span>
  );
}
