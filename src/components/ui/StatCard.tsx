interface StatCardProps {
  label: string;
  value: string;
}

/** Matches the 4-up stat-tile row used on Dashboard, Staff, Customers, Payments. */
export function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="rounded-[14px] border border-tn-border p-[18px]">
      <p className="m-0 font-sans text-xs text-tn-muted-5">{label}</p>
      <p className="m-0 mt-1.5 font-sans text-[26px] font-semibold text-tn-ink">{value}</p>
    </div>
  );
}

export default StatCard;
