import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { AddWalkInModal } from "@/components/waitlist/AddWalkInModal";
import { NOW_SERVING, WAITING } from "@/lib/sample-data";

type View = "list" | "board";

/** Matches the mockup's T8 / T8b Waitlist frames (list & board views), plus the T8c add-walk-in modal. */
export function WaitlistPage() {
  const [view, setView] = useState<View>("list");
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="m-0 font-serif text-[26px] font-semibold text-tn-ink">Live Waitlist</h1>
        <div className="flex items-center gap-3.5">
          <SegmentedControl
            value={view}
            onChange={setView}
            options={[
              { value: "list", label: "List" },
              { value: "board", label: "Board" },
            ]}
          />
          <div className="flex items-center gap-2 rounded-full bg-tn-success-bg px-3.5 py-2">
            <span className="h-2 w-2 rounded-full bg-tn-success" />
            <span className="font-sans text-xs font-semibold text-tn-success">
              {WAITING.length} waiting
            </span>
          </div>
          <Button onClick={() => setModalOpen(true)}>+ Add Walk-in</Button>
        </div>
      </div>

      {view === "list" ? (
        <>
          <div>
            <p className="m-0 mb-3 font-sans text-[13px] font-semibold tracking-[0.02em] text-tn-muted-1">
              NOW SERVING
            </p>
            <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border">
              {NOW_SERVING.map((s, i) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-4 px-[18px] py-3.5 ${
                    i < NOW_SERVING.length - 1 ? "border-b border-tn-border-soft" : ""
                  }`}
                >
                  <Avatar initials={s.initials} color={s.avatarColor} />
                  <div className="flex-1">
                    <p className="m-0 font-sans text-[13px] font-semibold text-tn-ink">
                      {s.customer} · {s.service}
                    </p>
                    <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">With {s.barber}</p>
                  </div>
                  <span className="font-sans text-xs font-semibold text-tn-gold">
                    {s.minutesLeft} min left
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="m-0 mb-3 font-sans text-[13px] font-semibold tracking-[0.02em] text-tn-muted-1">
              WAITING
            </p>
            <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border">
              {WAITING.map((w, i) => (
                <div
                  key={w.id}
                  className={`flex items-center gap-4 px-[18px] py-3.5 ${
                    w.position === 1 ? "bg-tn-gold-bg-soft" : ""
                  } ${i < WAITING.length - 1 ? "border-b border-tn-border-soft" : ""}`}
                >
                  <span
                    className={`w-6 flex-none font-sans text-[13px] font-semibold ${
                      w.position === 1 ? "text-tn-gold" : "text-tn-muted-5"
                    }`}
                  >
                    #{w.position}
                  </span>
                  <div className="flex-1">
                    <p className="m-0 font-sans text-[13px] font-semibold text-tn-ink">
                      {w.customer} · {w.service}
                    </p>
                    <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">
                      Waiting {w.waitingSince} · {w.preference}
                    </p>
                  </div>
                  {w.position === 1 ? (
                    <Button size="sm" className="rounded-full">
                      Call In
                    </Button>
                  ) : (
                    <span className="font-sans text-xs font-medium text-tn-muted-5">
                      {w.estimate}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <div>
            <p className="m-0 mb-3 font-sans text-[13px] font-semibold tracking-[0.02em] text-tn-muted-1">
              CHAIRS — NOW SERVING
            </p>
            <div className="flex gap-4">
              {NOW_SERVING.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-1 flex-col items-center gap-3 rounded-2xl border border-tn-border p-5 text-center"
                >
                  <div
                    className="flex h-[84px] w-[84px] items-center justify-center rounded-full"
                    style={{
                      background: `conic-gradient(var(--color-tn-gold) ${s.progressDeg}deg, var(--color-tn-border-softer) 0deg)`,
                    }}
                  >
                    <Avatar initials={s.initials} color={s.avatarColor} size={68} />
                  </div>
                  <div>
                    <p className="m-0 font-sans text-sm font-semibold text-tn-ink">{s.barber}</p>
                    <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">
                      with {s.customer}
                    </p>
                  </div>
                  <span className="rounded-full bg-tn-page px-3 py-1.5 font-sans text-[11px] font-medium text-tn-muted-2">
                    {s.service}
                  </span>
                  <span className="font-sans text-xs font-semibold text-tn-gold">
                    {s.minutesLeft} min left
                  </span>
                </div>
              ))}
              <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-tn-input-border p-5 text-center text-tn-faint">
                <div className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-tn-page text-xl">
                  ○
                </div>
                <p className="m-0 font-sans text-[13px] font-semibold">Ray Ortiz</p>
                <p className="m-0 font-sans text-xs font-medium">Open — ready for next</p>
              </div>
            </div>
          </div>

          <div>
            <p className="m-0 mb-3 font-sans text-[13px] font-semibold tracking-[0.02em] text-tn-muted-1">
              UP NEXT
            </p>
            <div className="flex gap-6 overflow-x-auto px-1 pb-1 pt-2">
              {WAITING.map((w) => (
                <div key={w.id} className="flex min-w-[104px] flex-col items-center gap-2">
                  <div className="relative">
                    <div
                      className={`flex h-[52px] w-[52px] items-center justify-center rounded-full border-2 font-sans text-base font-semibold ${
                        w.position === 1
                          ? "border-tn-gold bg-tn-gold-bg text-tn-gold"
                          : "border-tn-border bg-tn-page text-tn-muted-2"
                      }`}
                    >
                      {w.customer
                        .split(" ")
                        .map((p) => p[0])
                        .join("")}
                    </div>
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tn-dark font-sans text-[10px] font-semibold text-tn-on-dark">
                      {w.position}
                    </span>
                  </div>
                  <p className="m-0 whitespace-nowrap font-sans text-xs font-semibold text-tn-ink">
                    {w.customer}
                  </p>
                  <p className="m-0 whitespace-nowrap font-sans text-[11px] text-tn-muted-5">
                    {w.service}
                  </p>
                  <span className="font-sans text-[11px] font-semibold text-tn-gold">
                    {w.position === 1 ? `${w.waitingSince}` : w.estimate}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <AddWalkInModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

export default WaitlistPage;
