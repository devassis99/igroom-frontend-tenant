import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, formInputClass } from "@/components/ui/FormField";
import { Toggle } from "@/components/ui/Toggle";
import { PhoneInput, isPhoneValid } from "@/components/ui/PhoneInput";
import { useAuthStore } from "@/auth/auth-store";
import { createCustomer } from "@/lib/customers-api";

interface AddCustomerModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * T10c's "+ Add Customer" — for entering someone directly (a walk-in
 * without the app, or anyone else not already on file). Most customers
 * land on this list automatically the first time they're booked (see
 * bookings.service.ts's createBooking / customers.service.ts's
 * findOrCreateCustomerForBooking) — this modal is for the rest.
 */
export function AddCustomerModal({ open, onClose }: AddCustomerModalProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isVip, setIsVip] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createCustomer(accessToken ?? "", {
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        isVip,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      handleClose();
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : "Couldn't add this customer — try again.");
    },
  });

  function handleClose() {
    onClose();
    setName("");
    setPhone("");
    setEmail("");
    setIsVip(false);
    setFormError(null);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("Give this customer a name.");
      return;
    }
    if (!isPhoneValid(phone)) {
      setFormError("That phone number doesn't look right for the selected country.");
      return;
    }
    setFormError(null);
    mutation.mutate();
  }

  return (
    // A side sheet, matching the Locations and Add/Edit Member forms:
    // every "create this record" form in the app now arrives from the same
    // edge, and the customer list stays visible behind it so you can see
    // whether someone is already on file before adding them again.
    <Modal open={open} onClose={handleClose} width={460} variant="sheet">
      <form onSubmit={handleSubmit}>
        <div className="flex items-center justify-between px-6 pt-6">
          <h2 className="m-0 font-sans text-lg font-semibold text-tn-ink">Add Customer</h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="cursor-pointer border-none bg-transparent font-sans text-xl text-tn-muted-6"
          >
            &times;
          </button>
        </div>

        <div className="flex flex-col gap-4 px-6 pb-6 pt-4">
          <Field label="NAME">
            <input
              type="text"
              placeholder="e.g. Jordan Rivera"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={formInputClass}
            />
          </Field>
          <Field label="PHONE">
            <PhoneInput value={phone} onChange={setPhone} />
          </Field>
          <Field label="EMAIL">
            <input
              type="email"
              placeholder="jordan@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={formInputClass}
            />
          </Field>
          <Toggle checked={isVip} onChange={setIsVip} label="VIP" />

          {formError && <p className="m-0 font-sans text-sm text-tn-danger">{formError}</p>}

          <div className="flex gap-2.5 pt-1">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={handleClose}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? "Adding…" : "Add Customer"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default AddCustomerModal;
