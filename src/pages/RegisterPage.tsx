import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { LocationFilterPopover } from "@/components/ui/LocationFilterPopover";
import { TicketPanel } from "@/components/pos/TicketPanel";
import { PermissionNotice, isForbidden } from "@/components/pos/PermissionNotice";
import { useAuthStore } from "@/auth/auth-store";
import { ApiError } from "@/lib/http";
import { listLocations } from "@/lib/locations-api";
import {
  formatCents,
  getRegisterDay,
  openTicket,
  posKeys,
  type RegisterAppointment,
  type ServiceState,
} from "@/lib/pos-api";

/**
 * The register.
 *
 * The sale starts in the chair, not in an empty cart — which is the one
 * thing a bolt-on card reader cannot do, because it never took the
 * booking. Tapping an appointment opens a ticket already carrying the
 * client, the barber, the service, the price and whatever the
 * marketplace collected online.
 *
 * The day list re-reads on a timer for the same reason the waitlist board
 * does: two people work this screen at once on a Saturday, and a stale
 * "unpaid" chip is how the same haircut gets charged twice.
 *
 * Money comes after the work. Every appointment of the day is listed,
 * but only one a barber has marked complete can be rung up — the rest
 * carry their state and a disabled button that says what has to happen
 * first. The register never declares the service finished; that belongs
 * to whoever did it, on the calendar or on the queue.
 */
const POLL_MS = 20_000;

function errorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) return error.message;
  return "Something went wrong. Try again.";
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * Where the service has got to, for every row that is not finished yet.
 *
 * Completed rows show nothing here — for those the payment chip is the
 * whole story, and a second chip saying "completed" beside a "PAID"
 * one is noise.
 */
const SERVICE_STATE_LABEL: Record<Exclude<ServiceState, "completed">, string> = {
  not_arrived: "NOT ARRIVED",
  waiting: "WAITING",
  in_service: "IN SERVICE",
  unfinished: "NOT FINISHED",
};

function ServiceChip({ state }: { state: ServiceState }) {
  if (state === "completed") return null;
  /*
   * "unfinished" is the one that needs chasing rather than waiting on —
   * the window has passed and nobody closed it — so it is the only one
   * given any urgency.
   */
  const tone =
    state === "unfinished"
      ? "bg-tn-danger-bg text-tn-danger"
      : state === "in_service"
        ? "bg-tn-gold-bg text-tn-gold"
        : "bg-tn-page text-tn-muted-3";
  return (
    <span className={`rounded-full px-2.5 py-1 font-sans text-[11px] font-semibold ${tone}`}>
      {SERVICE_STATE_LABEL[state]}
    </span>
  );
}

/**
 * The chip on the right of each row. Three states, because they are the
 * three the front desk actually has to tell apart before taking money:
 * already rung up, part-paid online, or nothing collected yet.
 */
function PaymentChip({ appointment }: { appointment: RegisterAppointment }) {
  if (appointment.ticketStatus === "paid") {
    return (
      <span className="rounded-full bg-tn-success-bg px-2.5 py-1 font-sans text-[11px] font-semibold text-tn-success">
        PAID · #{appointment.ticketNumber}
      </span>
    );
  }
  if (appointment.ticketStatus === "open") {
    return (
      <span className="rounded-full bg-tn-gold-bg px-2.5 py-1 font-sans text-[11px] font-semibold text-tn-gold">
        OPEN · #{appointment.ticketNumber}
      </span>
    );
  }
  if (appointment.onlinePaymentType === "full") {
    return (
      <span className="rounded-full bg-tn-success-bg px-2.5 py-1 font-sans text-[11px] font-semibold text-tn-success">
        PAID ONLINE
      </span>
    );
  }
  if (appointment.onlinePaymentType === "deposit") {
    return (
      <span className="rounded-full bg-tn-page px-2.5 py-1 font-sans text-[11px] font-semibold text-tn-muted-3">
        {formatCents(appointment.paidOnlineCents)} DEP.
      </span>
    );
  }
  return (
    <span className="font-sans text-[13px] font-semibold text-tn-ink">
      {formatCents(appointment.priceCents)}
    </span>
  );
}

export function RegisterPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();
  const [chosenLocationId, setChosenLocationId] = useState<string | null>(null);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: () => listLocations(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });

  /**
   * Only branches this caller can act on. GET /locations returns the
   * whole account with an `inScope` flag because the admin page needs
   * it; every call on this page is branch-scoped, so offering a shop the
   * register will refuse is a 403 with extra steps. Same filter as
   * Calendar and Waitlist.
   */
  const locations = useMemo(
    () => (locationsQuery.data?.locations ?? []).filter((l) => l.inScope),
    [locationsQuery.data],
  );
  const defaultLocationId = useMemo(
    () => locations.find((l) => l.isPrimary)?.id ?? locations[0]?.id ?? "",
    [locations],
  );
  const selectedLocationId = chosenLocationId ?? defaultLocationId;

  const dayQuery = useQuery({
    queryKey: posKeys.day(selectedLocationId),
    queryFn: () => getRegisterDay(accessToken ?? "", selectedLocationId),
    enabled: Boolean(accessToken && selectedLocationId),
    refetchInterval: POLL_MS,
    placeholderData: keepPreviousData,
  });
  const day = dayQuery.data;

  const refreshDay = () =>
    queryClient.invalidateQueries({ queryKey: posKeys.day(selectedLocationId) });

  const open = useMutation({
    mutationFn: (appointment: RegisterAppointment | null) =>
      openTicket(accessToken ?? "", {
        locationId: selectedLocationId,
        ...(appointment ? { bookingId: appointment.bookingId } : { customerName: "Counter sale" }),
      }),
    onSuccess: async (ticket) => {
      setActiveTicketId(ticket.id);
      queryClient.setQueryData(posKeys.ticket(ticket.id), ticket);
      await refreshDay();
    },
  });

  const notice = errorMessage(open.error) ?? errorMessage(dayQuery.error);

  if (isForbidden(dayQuery.error)) {
    return (
      <PermissionNotice
        title="Register"
        what="Ringing up sales needs the “Use the register” permission."
      />
    );
  }

  if (locationsQuery.isSuccess && locations.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="m-0 font-serif text-[26px] font-semibold text-tn-ink">Register</h1>
        <p className="m-0 max-w-[60ch] font-sans text-sm text-tn-muted-3">
          You are not assigned to a branch yet, so there is no till to open. Ask an owner or manager
          to add you to a location.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="m-0 font-serif text-[26px] font-semibold text-tn-ink">Register</h1>
          {locations.length > 1 && (
            <LocationFilterPopover
              locations={locations.map((l) => ({ id: l.id, name: l.name }))}
              value={selectedLocationId}
              onChange={setChosenLocationId}
              label="Choose a branch"
              includeAllOption={false}
            />
          )}
        </div>
        <Button variant="secondary" onClick={() => open.mutate(null)} disabled={open.isPending}>
          + Counter sale
        </Button>
      </div>

      {notice && (
        <p className="m-0 rounded-xl border border-tn-danger bg-tn-danger-bg px-4 py-3 font-sans text-[13px] text-tn-danger">
          {notice}
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <p className="m-0 font-sans text-xs font-semibold tracking-[0.1em] text-tn-muted-5">
              TODAY · {day?.shopName ?? "…"}
            </p>
            <span className="font-sans text-xs text-tn-muted-5">
              {day
                ? new Date(`${day.businessDate}T12:00:00`).toLocaleDateString([], {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })
                : ""}
            </span>
          </div>

          {dayQuery.isLoading && (
            <p className="m-0 font-sans text-sm text-tn-muted-3">Loading the day…</p>
          )}

          {day && day.appointments.length === 0 && (
            <div className="rounded-2xl border border-dashed border-tn-border px-5 py-10 text-center">
              <p className="m-0 font-sans text-sm font-semibold text-tn-ink">
                Nothing booked today
              </p>
              <p className="m-0 mt-1 font-sans text-[13px] text-tn-muted-3">
                Start a counter sale for a walk-up, or seat someone from the waitlist first.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {day?.appointments.map((appointment) => {
              const isDone = appointment.ticketStatus === "paid";
              return (
                <div
                  key={appointment.bookingId}
                  className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${
                    isDone
                      ? "border-tn-border-soft opacity-60"
                      : appointment.ticketStatus === "open"
                        ? "border-tn-gold bg-tn-gold-bg-soft"
                        : "border-tn-border"
                  }`}
                >
                  <span className="w-[64px] shrink-0 font-sans text-xs font-medium text-tn-muted-5">
                    {timeLabel(appointment.startAt)}
                  </span>
                  <div className="min-w-[160px] flex-1">
                    <p className="m-0 font-sans text-[13px] font-semibold text-tn-ink">
                      {appointment.customerName}
                    </p>
                    <p className="m-0 font-sans text-[11px] text-tn-muted-3">
                      {appointment.serviceName} · {appointment.durationMinutes} min
                      {appointment.staffName ? ` · ${appointment.staffName}` : ""}
                    </p>
                  </div>
                  <ServiceChip state={appointment.serviceState} />
                  <PaymentChip appointment={appointment} />
                  {!isDone && (
                    <Button
                      size="sm"
                      variant={appointment.ticketStatus === "open" ? "primary" : "secondary"}
                      onClick={() =>
                        appointment.ticketId
                          ? setActiveTicketId(appointment.ticketId)
                          : open.mutate(appointment)
                      }
                      /*
                       * A ticket already open stays reachable whatever
                       * the booking says — somebody is mid-sale on it,
                       * and stranding them behind a status is worse
                       * than the rule it would be enforcing.
                       */
                      disabled={
                        open.isPending ||
                        (!appointment.payable && appointment.ticketStatus !== "open")
                      }
                      title={
                        appointment.payable
                          ? undefined
                          : (appointment.notPayableReason ?? undefined)
                      }
                    >
                      {appointment.ticketStatus === "open" ? "Back to ticket" : "Finish & pay →"}
                    </Button>
                  )}
                  {!isDone && !appointment.payable && appointment.notPayableReason && (
                    <p className="m-0 w-full font-sans text-[11px] text-tn-muted-3">
                      {appointment.notPayableReason}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <TicketPanel
          // Keyed so a different ticket is a different component
          // instance — see the comment on TicketPanel's state.
          key={activeTicketId ?? "none"}
          ticketId={activeTicketId}
          locationId={selectedLocationId}
          onClosed={async () => {
            await refreshDay();
          }}
          onDismiss={() => setActiveTicketId(null)}
        />
      </div>
    </div>
  );
}

export default RegisterPage;
