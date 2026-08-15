interface StepProgressProps {
  step: number;
  total: number;
}

/** The two-bar (or N-bar) progress indicator under each signup step's heading (T2/T3). */
export function StepProgress({ step, total }: StepProgressProps) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          className={`h-1 flex-1 rounded-full ${i < step ? "bg-tn-dark" : "bg-tn-border-softer"}`}
        />
      ))}
    </div>
  );
}

export default StepProgress;
