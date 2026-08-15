import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { AppointmentModal } from "@/components/calendar/AppointmentModal";

type View = "day" | "week" | "month";

const BARBERS = ["Marcus", "Devon", "Ray"];
const DAY_SLOTS = ["1:00 PM", "1:45 PM", "2:30 PM"];

/** [barberIndex]: appointment label, or null for an empty cell. */
const DAY_APPOINTMENTS: Record<number, Array<{ barber: number; label: string; tone: "gold" | "success" | "neutral" } | null>> = {
  0: [{ barber: 0, label: "Jordan Rivera\nHaircut & Trim", tone: "gold" }],
  1: [{ barber: 1, label: "Alex R.\nSkin Fade", tone: "success" }],
  2: [{ barber: 2, label: "Sam K. (walk-in)\nClassic Haircut", tone: "neutral" }],
};

const TONE_CLASS: Record<"gold" | "success" | "neutral", string> = {
  gold: "bg-tn-gold-bg border-l-[3px] border-tn-gold",
  success: "bg-tn-success-bg border-l-[3px] border-tn-success",
  neutral: "bg-tn-page border-l-[3px] border-tn-faint",
};

const WEEK_DAYS = [
  { label: "MON 10", entries: [{ time: "9:30", name: "Priya N.", service: "Haircut", tone: "neutral" as const }, { time: "2:00", name: "Alex R.", service: "Skin Fade", tone: "success" as const }] },
  { label: "TUE 11", entries: [{ time: "11:00", name: "Omar F.", service: "Fade", tone: "gold" as const }] },
  { label: "WED 12", entries: [{ time: "1:00", name: "Jordan R.", service: "Haircut & Trim", tone: "gold" as const }, { time: "1:45", name: "Alex R.", service: "Skin Fade", tone: "success" as const }, { time: "2:30", name: "Sam K. (walk-in)", service: "Classic Haircut", tone: "neutral" as const }], today: true },
  { label: "THU 13", entries: [{ time: "10:15", name: "Nadia S.", service: "Balayage", tone: "success" as const }] },
  { label: "FRI 14", entries: [{ time: "4:00", name: "Devon P.", service: "Beard Trim", tone: "gold" as const }] },
  { label: "SAT 15", entries: [{ time: "12:00", name: "Walk-ins only", service: "", tone: "neutral" as const }] },
  { label: "SUN 16", entries: [], closed: true },
];

const MONTH_WEEKS = [
  [27, 28, 29, 30, 31, 1, 2],
  [3, 4, 5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14, 15, 16],
  [17, 18, 19, 20, 21, 22, 23],
  [24, 25, 26, 27, 28, 29, 30],
];
const MONTH_BOOKINGS: Record<number, number> = {
  4: 3,
  6: 5,
  8: 2,
  10: 4,
  11: 3,
  12: 6,
  13: 2,
  14: 5,
  15: 3,
  17: 2,
  18: 4,
  20: 3,
  21: 5,
  22: 2,
};
const CURRENT_DAY = 12;
const OUT_OF_MONTH = new Set([27, 28, 29, 30, 31]);

/** Matches the mockup's T7 / T7-week / T7-month Calendar frames, plus the T7c/d/e appointment modal. */
export function CalendarPage() {
  const [view, setView] = useState<View>("day");
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <h1 className="m-0 font-serif text-[26px] font-semibold text-tn-ink">Calendar</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-tn-input-border bg-tn-page px-3 py-1.5 font-sans text-xs font-semibold text-tn-ink-soft">
            The Gentry · Downtown <span className="text-[9px] text-tn-muted-6">▾</span>
          </span>
        </div>
        <div className="flex items-center gap-3.5">
          <div className="flex items-center gap-1.5">
            <span className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-lg border border-tn-input-border text-tn-muted-4">
              ‹
            </span>
            <span className="min-w-[110px] text-center font-sans text-[13px] font-semibold text-tn-ink-soft">
              {view === "day" ? "Wed, Aug 12" : view === "week" ? "Aug 10 – Aug 16" : "August 2026"}
            </span>
            <span className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-lg border border-tn-input-border text-tn-muted-4">
              ›
            </span>
          </div>
          <SegmentedControl
            value={view}
            onChange={setView}
            options={[
              { value: "day", label: "Day" },
              { value: "week", label: "Week" },
              { value: "month", label: "Month" },
            ]}
          />
          <Button>+ Add Booking</Button>
        </div>
      </div>

      {view === "day" && (
        <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border">
          <div className="grid grid-cols-[70px_repeat(3,1fr)] border-b border-tn-border-softer">
            <div />
            {BARBERS.map((b) => (
              <div
                key={b}
                className="border-l border-tn-border-soft p-3 font-sans text-[13px] font-semibold text-tn-ink"
              >
                {b}
              </div>
            ))}
          </div>
          {DAY_SLOTS.map((slot, rowIndex) => (
            <div
              key={slot}
              className={`grid min-h-16 grid-cols-[70px_repeat(3,1fr)] ${
                rowIndex < DAY_SLOTS.length - 1 ? "border-b border-tn-border-soft" : ""
              }`}
            >
              <div className="p-2.5 font-sans text-xs font-medium text-tn-muted-5">{slot}</div>
              {BARBERS.map((_, barberIndex) => {
                const apt = DAY_APPOINTMENTS[rowIndex]?.find((a) => a?.barber === barberIndex);
                return (
                  <div key={barberIndex} className="border-l border-tn-border-soft p-2">
                    {apt && (
                      <button
                        type="button"
                        onClick={() => setModalOpen(true)}
                        className={`w-full whitespace-pre-line rounded-md p-2 text-left font-sans text-xs font-medium text-tn-ink-soft ${TONE_CLASS[apt.tone]}`}
                      >
                        {apt.label}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {view === "week" && (
        <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border">
          <div className="grid grid-cols-7 border-b border-tn-border-softer">
            {WEEK_DAYS.map((day) => (
              <div
                key={day.label}
                className={`border-l border-tn-border-soft px-3 py-2.5 font-sans text-[11px] font-medium ${
                  day.today ? "bg-tn-gold-bg-soft text-tn-gold font-semibold" : "text-tn-muted-5"
                }`}
              >
                {day.label}
              </div>
            ))}
          </div>
          <div className="grid min-h-[360px] grid-cols-7">
            {WEEK_DAYS.map((day) => (
              <div key={day.label} className="flex flex-col gap-1.5 border-l border-tn-border-soft p-2">
                {day.closed && <span className="text-center font-sans text-[11px] text-tn-faint">Closed</span>}
                {day.entries.map((entry, i) => (
                  <div
                    key={i}
                    className={`rounded-md p-1.5 font-sans text-[11px] font-medium text-tn-ink-soft ${TONE_CLASS[entry.tone]}`}
                  >
                    {entry.time} {entry.name}
                    {entry.service && <br />}
                    {entry.service}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "month" && (
        <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border">
          <div className="grid grid-cols-7 border-b border-tn-border-softer bg-tn-table-head">
            {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d) => (
              <div key={d} className="px-2.5 py-2 font-sans text-[11px] font-semibold text-tn-muted-5">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 grid-rows-5">
            {MONTH_WEEKS.map((week, wi) =>
              week.map((day, di) => {
                const isOut = wi === 0 && OUT_OF_MONTH.has(day);
                const isToday = day === CURRENT_DAY && !isOut;
                const bookings = !isOut ? MONTH_BOOKINGS[day] : undefined;
                return (
                  <div
                    key={`${wi}-${di}`}
                    className={`flex flex-col gap-1 border-l border-t border-tn-border-soft p-2 ${
                      isToday ? "border-t-2 border-t-tn-gold bg-tn-gold-bg-soft" : ""
                    }`}
                  >
                    <span
                      className={`font-sans text-[11px] ${
                        isOut
                          ? "font-medium text-tn-faint-2"
                          : isToday
                            ? "font-bold text-tn-gold"
                            : "font-semibold text-tn-ink"
                      }`}
                    >
                      {day}
                    </span>
                    {bookings && (
                      <span
                        className={`w-fit rounded px-1.5 py-0.5 font-sans text-[10px] font-medium ${
                          bookings >= 4 ? "bg-tn-gold-bg text-tn-gold" : "bg-tn-page text-tn-muted-3"
                        }`}
                      >
                        {bookings} bookings
                      </span>
                    )}
                  </div>
                );
              }),
            )}
          </div>
        </div>
      )}

      <AppointmentModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

export default CalendarPage;
