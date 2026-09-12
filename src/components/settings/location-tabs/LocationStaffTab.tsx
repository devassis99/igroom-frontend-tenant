import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/auth/auth-store";
import {
  getBarberDemand,
  listLocationStaff,
  updateLocation,
  type AccountLocation,
  type BarberDemand,
} from "@/lib/locations-api";

type BarberChoice = AccountLocation["barberChoice"];

const CHOICES: { value: BarberChoice; title: string; body: string }[] = [
  {
    value: "none",
    title: "No — shop assigns",
    body: "Even load, no requests. Fine for walk-in style shops.",
  },
  {
    value: "optional",
    title: "Optional — any barber first",
    body: "Customers can request a name, but “any barber” is preselected and shows more slots.",
  },
  {
    value: "required",
    title: "Required — must pick",
    body: "For shops where the barber is the product. Expect uneven books.",
  },
];

/** The reserve moves in fives; anything finer is a number nobody can feel the difference in. */
const RESERVE_STEP = 5;
/**
 * The most of a day a shop can hold back.
 *
 * Above this a shop has effectively stopped taking requests, which is what
 * "No — shop assigns" is for, and it would leave a named customer staring
 * at a day that is visibly open. The same ceiling the API enforces.
 */
const RESERVE_MAX = 80;

function Initials({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
  return (
    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-tn-avatar-tan font-sans text-[11px] font-semibold text-tn-ink">
      {initials}
    </span>
  );
}

/**
 * Who works at this location, and what a customer is allowed to ask of
 * them.
 *
 * Two things on one tab because they are one question. "Can customers
 * choose their barber?" has no correct answer in the abstract — it
 * depends on whether this shop's barbers are interchangeable, which is
 * something the owner knows and we don't — but it has a *measurable*
 * answer here: who is already full, who is already asked for, and what a
 * customer would be shown today. That evidence sits beside the switch
 * rather than in an analytics page nobody opens before deciding.
 *
 * The roster below stays read-only. Assigning people to locations,
 * changing roles and inviting new members all live in Staff Management,
 * which has the whole wizard for it; duplicating a slice of that here
 * would give an owner two places to do one job and one of them would
 * drift.
 */
export function LocationStaffTab({
  location,
  canManage,
}: {
  location: AccountLocation;
  canManage: boolean;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const [choice, setChoice] = useState<BarberChoice>(location.barberChoice);
  const [reserve, setReserve] = useState(location.anyBarberReservePct);
  const [error, setError] = useState<string | null>(null);

  // Re-seeded when the selected location changes — the panel stays mounted
  // while an owner clicks between shops in the list beside it.
  useEffect(() => {
    setChoice(location.barberChoice);
    setReserve(location.anyBarberReservePct);
    setError(null);
  }, [location]);

  const staffQuery = useQuery({
    queryKey: ["location-staff", location.id],
    queryFn: () => listLocationStaff(accessToken ?? "", location.id),
    enabled: !!accessToken,
  });

  const demandQuery = useQuery({
    queryKey: ["barber-demand", location.id],
    queryFn: () => getBarberDemand(accessToken ?? "", location.id),
    enabled: !!accessToken,
    // It runs today's availability once per barber, and nothing in it
    // changes minute to minute.
    staleTime: 2 * 60_000,
  });

  const save = useMutation({
    mutationFn: () =>
      updateLocation(accessToken ?? "", location.id, {
        barberChoice: choice,
        anyBarberReservePct: reserve,
      }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["locations"] });
      // The rail is downstream of both settings — the reserve changes what
      // a customer would be shown today, which is the whole point of it.
      void queryClient.invalidateQueries({ queryKey: ["barber-demand", location.id] });
    },
    onError: (err: unknown) =>
      setError(err instanceof Error ? err.message : "Couldn’t save these settings"),
  });

  const dirty = choice !== location.barberChoice || reserve !== location.anyBarberReservePct;
  const demand = demandQuery.data;
  const busiest = [...(demand?.barbers ?? [])]
    .filter((barber) => barber.bookedPct !== null)
    .sort((a, b) => (b.bookedPct ?? 0) - (a.bookedPct ?? 0))[0];

  return (
    <div className="flex flex-col gap-5">
      {canManage && (
        <div className="flex items-center justify-end gap-3">
          {error && <span className="font-sans text-xs text-tn-danger">{error}</span>}
          <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-[420px] flex-1 flex-col gap-4">
          <section className="rounded-2xl border border-tn-border-soft bg-tn-surface p-5">
            <h3 className="m-0 font-sans text-[15px] font-semibold text-tn-ink">
              Can customers choose their barber?
            </h3>
            <p className="mt-1 mb-4 font-sans text-[12.5px] text-tn-muted-5">
              Applies to this location’s booking page only. Your other branches set their own.
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {CHOICES.map((option) => {
                const selected = choice === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={!canManage}
                    aria-pressed={selected}
                    onClick={() => setChoice(option.value)}
                    className={`flex cursor-pointer flex-col gap-1.5 rounded-xl p-3.5 text-left transition-colors disabled:cursor-not-allowed ${
                      selected
                        ? "border-[1.5px] border-tn-gold bg-tn-gold-bg-soft"
                        : "border border-tn-border bg-tn-surface hover:border-tn-input-border"
                    }`}
                  >
                    <span className="flex items-center gap-2 font-sans text-[13px] font-semibold text-tn-ink">
                      <span
                        aria-hidden
                        className={`h-2 w-2 flex-none rounded-full ${
                          selected ? "bg-tn-gold" : "bg-tn-border"
                        }`}
                      />
                      {option.title}
                    </span>
                    <span className="font-sans text-[12px] leading-snug text-tn-muted-5">
                      {option.body}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-tn-border-soft bg-tn-surface p-5">
            <h3 className="m-0 mb-4 font-sans text-[15px] font-semibold text-tn-ink">
              How requests are limited
            </h3>

            {choice === "none" ? (
              /* Nothing to limit: with the shop assigning, no booking is a
                 request in the first place. Said rather than shown greyed
                 with no explanation. */
              <p className="m-0 rounded-xl border border-dashed border-tn-border px-4 py-5 text-center font-sans text-[12.5px] text-tn-muted-5">
                Nothing to limit while the shop assigns — no booking is a request.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-sans text-[13px] text-tn-ink-soft">
                    Keep for any-barber bookings
                  </span>
                  <span className="font-sans text-[13px] font-semibold text-tn-ink">
                    {reserve === 0 ? "Off" : `${reserve}% of each day`}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={RESERVE_MAX}
                  step={RESERVE_STEP}
                  value={reserve}
                  disabled={!canManage}
                  aria-label="Share of each day kept for any-barber bookings"
                  onChange={(event) => setReserve(Number(event.target.value))}
                  className="tn-range w-full"
                  /* The fill has to be drawn from the value, and CSS can't
                     read one — so the track is a gradient with its stop at
                     the current percentage. */
                  style={{
                    background: `linear-gradient(to right, var(--color-tn-gold) 0%, var(--color-tn-gold) ${
                      (reserve / RESERVE_MAX) * 100
                    }%, var(--color-tn-border-softer) ${
                      (reserve / RESERVE_MAX) * 100
                    }%, var(--color-tn-border-softer) 100%)`,
                  }}
                />
                <p className="m-0 font-sans text-[12.5px] leading-relaxed text-tn-muted-5">
                  {reserve === 0
                    ? "Named requests can fill the whole day. Turn this up if one barber books out weeks ahead while the others sit empty."
                    : `Named requests can fill ${100 - reserve}% of ${
                        busiest ? `${firstName(busiest.name)}’s` : "a barber’s"
                      } day. The rest stays open so same-day customers and newer barbers still get work.`}
                </p>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3 rounded-2xl border border-tn-border-soft bg-tn-surface p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <p className="m-0 font-sans text-[13px] font-semibold text-tn-ink">
                  Roster · {staffQuery.data?.staff.length ?? 0}{" "}
                  {staffQuery.data?.staff.length === 1 ? "person" : "people"}
                </p>
                <p className="m-0 font-sans text-xs text-tn-muted-5">
                  Assign people to locations in Staff Management; this is who ends up here.
                </p>
              </div>
              <Link
                to="/staff"
                className="rounded-lg border border-tn-input-border px-2.5 py-1.5 font-sans text-[11px] font-semibold text-tn-ink-soft no-underline hover:bg-tn-page"
              >
                Staff Management
              </Link>
            </div>

            {staffQuery.isPending ? (
              <p className="m-0 font-sans text-sm text-tn-muted-5">Loading the roster…</p>
            ) : staffQuery.isError ? (
              <p className="m-0 font-sans text-sm text-tn-danger">Couldn’t load the roster.</p>
            ) : staffQuery.data.staff.length === 0 ? (
              <p className="m-0 rounded-2xl border border-dashed border-tn-border px-4 py-6 text-center font-sans text-sm text-tn-muted-5">
                Nobody works here yet — this location can’t take a booking until someone does.
              </p>
            ) : (
              <div className="rounded-2xl border border-tn-border">
                {staffQuery.data.staff.map((member, index) => (
                  <div
                    key={member.id}
                    className={`flex items-center gap-3 px-4 py-3 ${
                      index < staffQuery.data.staff.length - 1
                        ? "border-b border-tn-border-soft"
                        : ""
                    }`}
                  >
                    <Initials name={member.name} />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate font-sans text-[13px] font-semibold text-tn-ink">
                        {member.name}
                      </span>
                      <span className="truncate font-sans text-[11px] text-tn-muted-5">
                        {[member.displayTitle ?? member.roleName, member.email]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>
                    {/* `claimed`, not `isActive` — a row is active from the
                        moment the invite is created, so isActive never said
                        "Invited" at all and this badge only ever showed for
                        someone who had been deactivated. */}
                    {!member.claimed && <RosterBadge>Invited</RosterBadge>}
                    {!member.isActive && <RosterBadge>Deactivated</RosterBadge>}
                    {member.isActive && member.claimed && !member.hasHours && (
                      <RosterBadge tone="gold">No hours set</RosterBadge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="flex w-full flex-col gap-4 lg:w-[300px] lg:flex-none">
          <WhyThisMattersCard
            locationId={location.id}
            barbers={demand?.barbers ?? []}
            loading={demandQuery.isPending}
            namedSampleSize={demand?.namedSampleSize ?? 0}
            namedWindowDays={demand?.namedWindowDays ?? 30}
            bookedWindowDays={demand?.bookedWindowDays ?? 7}
          />
          <CustomerPreviewCard
            loading={demandQuery.isPending}
            anyBarberSlotsToday={demand?.anyBarberSlotsToday ?? 0}
            barbers={demand?.barbers ?? []}
            probeServiceName={demand?.probeService?.name ?? null}
            choice={choice}
          />
        </aside>
      </div>
    </div>
  );
}

function RosterBadge({ children, tone }: { children: string; tone?: "gold" }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-sans text-[10px] font-semibold ${
        tone === "gold" ? "bg-tn-gold-bg text-tn-gold" : "bg-tn-neutral-bg text-tn-muted-5"
      }`}
    >
      {children}
    </span>
  );
}

/**
 * The case for changing anything, in this shop's own numbers.
 *
 * Written as a sentence rather than a chart because it is an argument,
 * not a dataset: the gap between the barber who is full and the one who
 * isn't is the entire reason the settings beside it exist, and a bar
 * chart makes an owner do that subtraction themselves.
 *
 * Every clause is dropped when the number behind it isn't there — one
 * barber, no requests yet, nobody with hours. A panel that pads itself
 * with "0%" when it has nothing to say is a panel nobody believes the
 * second time.
 */
function WhyThisMattersCard({
  locationId,
  barbers,
  loading,
  namedSampleSize,
  namedWindowDays,
  bookedWindowDays,
}: {
  locationId: string;
  barbers: BarberDemand[];
  loading: boolean;
  namedSampleSize: number;
  namedWindowDays: number;
  bookedWindowDays: number;
}) {
  const ranked = [...barbers]
    .filter((barber) => barber.bookedPct !== null)
    .sort((a, b) => (b.bookedPct ?? 0) - (a.bookedPct ?? 0));
  const top = ranked[0];
  const bottom = ranked.length > 1 ? ranked[ranked.length - 1] : undefined;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-tn-gold-bg bg-tn-gold-bg-soft p-4">
      <h3 className="m-0 font-sans text-[13px] font-semibold text-tn-ink">Why this matters here</h3>

      {loading ? (
        <p className="m-0 font-sans text-[12.5px] text-tn-muted-5">Reading the last few weeks…</p>
      ) : !top ? (
        <p className="m-0 font-sans text-[12.5px] leading-relaxed text-tn-muted-5">
          Nobody here has working hours yet, so there’s nothing to measure. Set hours on the
          Availability tab and this fills in.
        </p>
      ) : (
        <p className="m-0 font-sans text-[12.5px] leading-relaxed text-tn-muted-3">
          {firstName(top.name)} is {top.bookedPct}% booked over the next{" "}
          {bookedWindowDays === 7 ? "week" : `${bookedWindowDays} days`}
          {top.namedSharePct !== null && ` and takes ${top.namedSharePct}% of named requests`}
          {bottom ? `, while ${firstName(bottom.name)} sits at ${bottom.bookedPct}%.` : "."}
          {namedSampleSize < 5 && (
            <>
              {" "}
              <span className="text-tn-muted-5">
                Too few requests in the last {namedWindowDays} days to say who is asked for.
              </span>
            </>
          )}
        </p>
      )}

      <Link
        to={`/calendar?view=week&location=${encodeURIComponent(locationId)}`}
        className="rounded-lg border border-tn-border bg-tn-surface px-3 py-2.5 text-center font-sans text-[12px] font-semibold text-tn-ink no-underline hover:bg-tn-page"
      >
        See the week by barber
      </Link>
    </section>
  );
}

/**
 * The same question a customer's screen answers, asked here first.
 *
 * These counts come from the booking page's own availability call, not a
 * cheaper one of our own — including the reserve, which is the only way
 * to see what turning it up actually costs. An owner sliding it from 0 to
 * 40 can save, look here, and find out that Faisal now shows two times
 * instead of nine before a customer does.
 */
function CustomerPreviewCard({
  loading,
  anyBarberSlotsToday,
  barbers,
  probeServiceName,
  choice,
}: {
  loading: boolean;
  anyBarberSlotsToday: number;
  barbers: BarberDemand[];
  probeServiceName: string | null;
  choice: BarberChoice;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-tn-border-soft bg-tn-surface p-4">
      <h3 className="m-0 font-sans text-[13px] font-semibold text-tn-ink">
        What the customer will see
      </h3>

      {loading ? (
        <p className="m-0 font-sans text-[12.5px] text-tn-muted-5">Checking today’s times…</p>
      ) : probeServiceName === null ? (
        <p className="m-0 font-sans text-[12.5px] leading-relaxed text-tn-muted-5">
          Nothing is bookable online here yet, so there is nothing to preview.
        </p>
      ) : (
        <>
          {/* "Any barber" only exists as a choice when asking for somebody
              is one. Under "Required" every customer names a name, and a
              row offering the opposite would be a preview of a screen
              they'll never see. */}
          {choice !== "required" && (
            <div className="flex items-center justify-between gap-3 rounded-xl border-[1.5px] border-tn-gold bg-tn-gold-bg-soft px-3.5 py-2.5">
              <span className="font-sans text-[13px] font-semibold text-tn-ink">Any barber</span>
              <span className="font-sans text-[12px] text-tn-muted-4">
                {slotLabel(anyBarberSlotsToday)}
              </span>
            </div>
          )}

          {choice === "none" ? (
            <p className="m-0 font-sans text-[12px] leading-relaxed text-tn-muted-5">
              With the shop assigning, that’s the whole screen — no barber list is shown.
            </p>
          ) : (
            barbers.map((barber) => (
              <div
                key={barber.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-tn-border-soft px-3.5 py-2.5"
              >
                <span className="min-w-0 truncate font-sans text-[13px] text-tn-ink">
                  {barber.name}
                </span>
                <span
                  className={`flex-none font-sans text-[12px] ${
                    barber.capReached ? "text-tn-gold" : "text-tn-muted-4"
                  }`}
                >
                  {barber.capReached ? "Reserve reached" : slotLabel(barber.slotsToday)}
                </span>
              </div>
            ))
          )}

          <p className="m-0 font-sans text-[11.5px] leading-relaxed text-tn-muted-6">
            Today, for {probeServiceName} — the shortest thing you sell online. Saved settings only;
            the slider above updates this after you save.
          </p>
        </>
      )}
    </section>
  );
}

function slotLabel(count: number): string {
  if (count === 0) return "nothing left today";
  return `${count} ${count === 1 ? "time" : "times"} today`;
}

/** "Faisal Ahmed" → "Faisal". Nobody says the surname when they mean the chair. */
function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

export default LocationStaffTab;
