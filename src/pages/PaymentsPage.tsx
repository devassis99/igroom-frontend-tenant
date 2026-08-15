import { StatCard } from "@/components/ui/StatCard";
import { RECENT_TRANSACTIONS } from "@/lib/sample-data";

/** Matches the mockup's T11 Payments frame. */
export function PaymentsPage() {
  return (
    <div className="flex flex-col gap-7">
      <h1 className="m-0 font-serif text-[26px] font-semibold text-tn-ink">Payments</h1>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatCard label="This week" value="$3,420" />
        <StatCard label="Pending payout" value="$612" />
        <StatCard label="Payout method" value="Bank ···· 4821" />
      </div>

      <div className="flex flex-col gap-3">
        <p className="m-0 font-sans text-base font-semibold text-tn-ink">Recent transactions</p>
        <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border">
          {RECENT_TRANSACTIONS.map((txn, i) => (
            <div
              key={txn.id}
              className={`flex items-center justify-between px-[18px] py-3.5 ${
                i < RECENT_TRANSACTIONS.length - 1 ? "border-b border-tn-border-soft" : ""
              }`}
            >
              <span className="font-sans text-[13px] font-medium text-tn-ink-soft">
                {txn.customer} · {txn.date}
              </span>
              <span className="font-sans text-[13px] font-semibold text-tn-ink">
                ${txn.amount.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PaymentsPage;
