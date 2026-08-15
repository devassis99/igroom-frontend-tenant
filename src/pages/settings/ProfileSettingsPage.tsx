import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, formInputClass, formSelectClass } from "@/components/ui/FormField";
import { PreviewAsCustomerModal } from "@/components/settings/PreviewAsCustomerModal";
import { useAuthStore } from "@/auth/auth-store";

const GALLERY_TAGS = ["Classic Haircut", "Interior", "Marcus Webb", "Skin Fade"];

/** Matches the mockup's T12 Profile page (Business Information + Public Profile / gallery). */
export function ProfileSettingsPage() {
  const owner = useAuthStore((s) => s.owner);
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="m-0 font-sans text-2xl font-semibold text-tn-ink">Profile</h1>

      <section className="flex flex-col gap-4">
        <p className="m-0 font-sans text-sm font-semibold text-tn-ink">Business Information</p>
        <Field label="BUSINESS NAME">
          <input
            type="text"
            defaultValue={owner?.businessName ?? "The Gentry Barbershop"}
            className={formInputClass}
          />
        </Field>
        <Field label="ADDRESS">
          <input
            type="text"
            defaultValue={owner?.address ?? "412 Congress Ave, Austin, TX"}
            className={formInputClass}
          />
        </Field>
        <Field label="CURRENCY">
          <select className={formSelectClass}>
            <option>USD — US Dollar</option>
            <option>PKR — Pakistani Rupee</option>
            <option>GBP — British Pound</option>
            <option>AED — UAE Dirham</option>
          </select>
        </Field>
        <Field label="TIME ZONE">
          <select className={formSelectClass}>
            <option>Central Time (Austin)</option>
            <option>Pakistan Standard Time</option>
            <option>Eastern Time</option>
            <option>Pacific Time</option>
          </select>
        </Field>
        <Button className="w-fit">Save Changes</Button>
      </section>

      <section className="flex flex-col gap-4 border-t border-tn-border-soft pt-6">
        <div className="flex items-center justify-between">
          <p className="m-0 font-sans text-sm font-semibold text-tn-ink">Public Profile</p>
          <Button variant="secondary" size="sm" onClick={() => setPreviewOpen(true)}>
            📱 Preview as Customer
          </Button>
        </div>
        <p className="m-0 -mt-2 font-sans text-xs text-tn-muted-5">
          What customers see on the iGroom app when they find your shop.
        </p>

        <div
          className="flex h-[140px] items-center justify-center rounded-2xl font-sans text-xs text-tn-muted-5"
          style={{
            background:
              "repeating-linear-gradient(45deg, oklch(90% 0.015 65), oklch(90% 0.015 65) 8px, oklch(94% 0.01 70) 8px, oklch(94% 0.01 70) 16px)",
          }}
        >
          cover photo
          <Button variant="secondary" size="sm" className="ml-3 bg-tn-surface">
            Replace
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-sans text-sm font-semibold text-tn-ink">Gallery</span>
          <span className="font-sans text-xs text-tn-muted-5">12 photos</span>
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          {GALLERY_TAGS.map((tag) => (
            <div
              key={tag}
              className="flex aspect-square flex-col items-center justify-end rounded-xl bg-tn-page p-2 text-center"
            >
              <span className="rounded-md bg-tn-surface px-1.5 py-0.5 font-sans text-[10px] font-medium text-tn-muted-3">
                {tag}
              </span>
            </div>
          ))}
          <button
            type="button"
            className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-tn-input-border font-sans text-xs text-tn-muted-5"
          >
            <span className="text-lg">+</span>
            Add
          </button>
        </div>
        <p className="m-0 font-sans text-xs text-tn-muted-6">
          Tag a photo to a service or team member so it can appear next to them in the app.
        </p>
      </section>

      <PreviewAsCustomerModal open={previewOpen} onClose={() => setPreviewOpen(false)} />
    </div>
  );
}

export default ProfileSettingsPage;
