import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, formInputClass, formSelectClass } from "@/components/ui/FormField";
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
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={formSelectClass}
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
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

          <div className="flex gap-4">
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="font-sans text-xs font-medium text-tn-muted-1">
                SERVICE DURATION
              </span>
              <div className="flex gap-2">
                <select
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                  className={`${formSelectClass} flex-1`}
                >
                  {HOURS_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                      {h} {h === 1 ? "hour" : "hours"}
                    </option>
                  ))}
                </select>
                <select
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                  className={`${formSelectClass} flex-1`}
                >
                  {MINUTES_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m} min
                    </option>
                  ))}
                </select>
              </div>
            </div>

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
