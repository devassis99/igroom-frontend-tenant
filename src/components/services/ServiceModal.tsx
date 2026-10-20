import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, formInputClass } from "@/components/ui/FormField";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import {
  createService,
  updateService,
  SALES_TAX_LABEL,
  type Service,
  type ServiceCategory,
} from "@/lib/services-api";

interface ServiceModalProps {
  open: boolean;
  onClose: () => void;
  /** null = Add Service, a Service = Edit Service prefilled from it. */
  service: Service | null;
  categories: ServiceCategory[];
  accessToken: string;
}

const HOURS_OPTIONS = [0, 1, 2, 3, 4];
const MINUTES_OPTIONS = [0, 15, 30, 45];

/**
 * The fixed choices, plus the current value if it isn't one of them — a
 * service saved as 50 minutes, say. A native select showed the first
 * option for a value it didn't have, which then saved over the real one.
 */
function withCurrent(choices: number[], current: number): number[] {
  if (choices.includes(current)) return choices;
  return [...choices.filter((c) => c < current), current, ...choices.filter((c) => c > current)];
}

function minutesToParts(durationMinutes: number) {
  return { hours: Math.floor(durationMinutes / 60), minutes: durationMinutes % 60 };
}

/** "$ 45.00" (or any loose "45", "45.5" input) -> 4500 cents. Never negative, never NaN. */
function parsePriceCents(raw: string): number {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 100);
}

function centsToPriceInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Matches the mockup's T9b Add/Edit Service modal — now a real, controlled, backend-backed form. */
export function ServiceModal({
  open,
  onClose,
  service,
  categories,
  accessToken,
}: ServiceModalProps) {
  const queryClient = useQueryClient();
  const isEdit = service !== null;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [taxable, setTaxable] = useState(true);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(30);
  const [priceInput, setPriceInput] = useState("0.00");
  const [onlineVisible, setOnlineVisible] = useState(true);
  const [requiresDeposit, setRequiresDeposit] = useState(false);
  const [kioskBookable, setKioskBookable] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const categoryOptions = useMemo<SelectOption<string>[]>(
    () => [
      { value: "", label: "No category" },
      ...categories.map((c) => ({ value: c.id, label: c.name })),
    ],
    [categories],
  );
  const hourOptions = useMemo<SelectOption<number>[]>(
    () =>
      withCurrent(HOURS_OPTIONS, hours).map((h) => ({
        value: h,
        label: `${h} ${h === 1 ? "hour" : "hours"}`,
      })),
    [hours],
  );
  const minuteOptions = useMemo<SelectOption<number>[]>(
    () => withCurrent(MINUTES_OPTIONS, minutes).map((m) => ({ value: m, label: `${m} min` })),
    [minutes],
  );

  // Re-sync whenever the modal is (re)opened, for whichever service (or
  // none, for Add) it was opened with — same pattern as AddBookingModal.
  useEffect(() => {
    if (!open) return;
    const { hours: h, minutes: m } = minutesToParts(service?.durationMinutes ?? 30);
    setName(service?.name ?? "");
    setDescription(service?.description ?? "");
    setCategoryId(service?.categoryId ?? "");
    setTaxable(service?.taxable ?? true);
    setHours(h);
    setMinutes(m);
    setPriceInput(centsToPriceInput(service?.priceCents ?? 0));
    setOnlineVisible(service?.onlineVisible ?? true);
    setRequiresDeposit(service?.requiresDeposit ?? false);
    setKioskBookable(service?.kioskBookable ?? true);
    setFormError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, service]);

  const mutation = useMutation({
    mutationFn: () => {
      const input = {
        categoryId: categoryId || null,
        name: name.trim(),
        description: description.trim() || null,
        durationMinutes: hours * 60 + minutes,
        priceCents: parsePriceCents(priceInput),
        taxable,
        onlineVisible,
        requiresDeposit,
        kioskBookable,
      };
      return isEdit
        ? updateService(accessToken, service.id, input)
        : createService(accessToken, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      // Whether a location has anything bookable online is part of its
      // setup state (AccountLocation.setupMissing) — hiding or enabling a
      // service can change it.
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      onClose();
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : "Couldn't save the service — try again.");
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError("Give the service a name.");
      return;
    }
    if (hours === 0 && minutes === 0) {
      setFormError("Duration must be at least a few minutes.");
      return;
    }
    mutation.mutate();
  }

  return (
    // A side sheet, same as the Locations, Member and Customer forms —
    // this is the longest of them (name, description, category, tax,
    // duration, price and three toggles), so a centred card had to scroll
    // inside a box that was already floating. Full height suits it, and
    // the services list stays visible behind for naming and pricing
    // against what's already there.
    <Modal open={open} onClose={onClose} width={520} variant="sheet">
      <form onSubmit={handleSubmit}>
        <div className="flex items-center justify-between px-6 pt-6">
          <h2 className="m-0 font-sans text-xl font-semibold text-tn-ink">
            {isEdit ? "Edit Service" : "Add Service"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer border-none bg-transparent font-sans text-xl text-tn-muted-6"
          >
            &times;
          </button>
        </div>

        <div className="flex flex-col gap-4 px-6 pb-6 pt-4">
          <Field label="SERVICE NAME">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Beard Color"
              className={formInputClass}
            />
          </Field>

          <Field label="DESCRIPTION (MAX 300 CHARACTERS)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 300))}
              rows={2}
              placeholder="Cover gray and even out beard tone with a semi-permanent color."
              className={`${formInputClass} resize-none`}
            />
          </Field>

          <Field label="CATEGORY">
            <Select
              label="Category"
              value={categoryId}
              options={categoryOptions}
              onChange={setCategoryId}
            />
          </Field>

          <div className="flex flex-col gap-1.5">
            <span className="font-sans text-xs font-medium text-tn-muted-1">
              SELECT TYPE OF TAX
            </span>
            <label className="flex items-center gap-2.5 rounded-xl border border-tn-input-border px-3.5 py-3 font-sans text-sm text-tn-ink">
              <input
                type="checkbox"
                checked={taxable}
                onChange={(e) => setTaxable(e.target.checked)}
                className="accent-tn-gold"
              />
              {SALES_TAX_LABEL}
            </label>
          </div>

          {/* 5:4, so each duration dropdown gets about as much room as the
              native selects took for themselves, and pricing the rest. */}
          <div className="flex gap-4">
            <div className="flex min-w-0 flex-[5] flex-col gap-1.5">
              <span className="font-sans text-xs font-medium text-tn-muted-1">
                SERVICE DURATION
              </span>
              <div className="flex gap-2">
                <Select
                  label="Hours"
                  value={hours}
                  options={hourOptions}
                  onChange={setHours}
                  className="flex-1"
                />
                <Select
                  label="Minutes"
                  value={minutes}
                  options={minuteOptions}
                  onChange={setMinutes}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="min-w-0 flex-[4]">
              <Field label="PRICING">
                <div className="flex items-center gap-1.5 rounded-xl border border-tn-input-border px-3.5 py-3 focus-within:border-2 focus-within:border-tn-gold">
                  <span className="font-sans text-sm text-tn-muted-4">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    onBlur={() => setPriceInput(centsToPriceInput(parsePriceCents(priceInput)))}
                    className="w-full border-none bg-transparent font-sans text-sm text-tn-ink outline-none"
                  />
                </div>
              </Field>
            </div>
          </div>

          <div className="flex flex-col gap-1 border-t border-tn-border-soft pt-3">
            <Toggle checked={onlineVisible} onChange={setOnlineVisible} label="Online visibility" />
            <Toggle
              checked={requiresDeposit}
              onChange={setRequiresDeposit}
              label="Requires prepaid deposit"
            />
            <Toggle
              checked={kioskBookable}
              onChange={setKioskBookable}
              label="Bookable at kiosk (walk-in)"
            />
          </div>

          {formError && <p className="m-0 font-sans text-xs text-tn-danger">{formError}</p>}

          <div className="flex gap-2.5">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save Service"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default ServiceModal;
