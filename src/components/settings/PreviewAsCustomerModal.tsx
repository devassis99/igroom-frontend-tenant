import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/auth/auth-store";
import { SERVICES, STAFF } from "@/lib/sample-data";

interface PreviewAsCustomerModalProps {
  open: boolean;
  onClose: () => void;
}

/** Matches the mockup's T12-preview "Preview as Customer" frame — what shoppers see on the iGroom app. */
export function PreviewAsCustomerModal({ open, onClose }: PreviewAsCustomerModalProps) {
  const owner = useAuthStore((s) => s.owner);

  return (
    <Modal open={open} onClose={onClose} width={420}>
      <div className="flex items-center justify-between px-5 pt-4">
        <span className="font-sans text-xs font-semibold text-tn-muted-5">
          Previewing as a customer
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="cursor-pointer border-none bg-transparent font-sans text-lg text-tn-muted-6"
        >
          &times;
        </button>
      </div>

      <div className="mt-3 flex flex-col">
        <div
          className="flex h-[140px] items-end justify-between px-4 pb-3"
          style={{
            background:
              "repeating-linear-gradient(45deg, oklch(90% 0.015 65), oklch(90% 0.015 65) 8px, oklch(94% 0.01 70) 8px, oklch(94% 0.01 70) 16px)",
          }}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-tn-surface/90">
            ←
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-tn-surface/90">
            ♡
          </span>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          <div>
            <p className="m-0 font-serif text-xl font-semibold text-tn-ink">
              {owner?.businessName ?? "The Gentry Barbershop"}
            </p>
            <p className="m-0 mt-1 font-sans text-xs text-tn-muted-4">
              ★ 4.9 <span className="text-tn-faint">(312 reviews)</span> ·{" "}
              {owner?.category ?? "Barbershop"}
            </p>
            <p className="m-0 mt-1 font-sans text-xs font-medium text-tn-success">
              Open now · closes 8:00 PM
            </p>
          </div>

          <div className="flex gap-4 border-b border-tn-border-soft font-sans text-[13px] font-medium text-tn-muted-5">
            <span className="border-b-2 border-tn-ink pb-2 font-semibold text-tn-ink">
              Services
            </span>
            <span className="pb-2">Offers</span>
            <span className="pb-2">Reviews</span>
            <span className="pb-2">About</span>
          </div>

          <div className="flex flex-col gap-3">
            {SERVICES.filter((s) => s.status === "Enabled")
              .slice(0, 2)
              .map((s) => (
                <div key={s.id} className="flex items-center justify-between">
                  <div>
                    <p className="m-0 font-sans text-[13px] font-semibold text-tn-ink">{s.name}</p>
                    <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">{s.duration}</p>
                  </div>
                  <span className="font-sans text-[13px] font-semibold text-tn-ink">
                    ${s.price}
                  </span>
                </div>
              ))}
          </div>

          <div>
            <p className="m-0 mb-2 font-sans text-[13px] font-semibold text-tn-ink">
              Meet the team
            </p>
            <div className="flex gap-3">
              {STAFF.filter((s) => s.role.includes("Barber")).map((b) => (
                <div key={b.id} className="flex flex-col items-center gap-1.5">
                  <div className="h-11 w-11 rounded-full" style={{ background: b.avatarColor }} />
                  <span className="font-sans text-[11px] text-tn-muted-4">
                    {b.name.split(" ")[0]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Button>Book Appointment</Button>
        </div>
      </div>
    </Modal>
  );
}

export default PreviewAsCustomerModal;
