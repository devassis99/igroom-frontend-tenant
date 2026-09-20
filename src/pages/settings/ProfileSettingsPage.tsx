import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Field, formInputClass, formSelectClass } from "@/components/ui/FormField";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { PreviewAsCustomerModal } from "@/components/settings/PreviewAsCustomerModal";
import { useAuthStore } from "@/auth/auth-store";
import { usePermissions } from "@/auth/use-permissions";
import { updateCoverPhoto } from "@/lib/accounts-api";
import { TourTipsCard } from "@/tour";

/** The mockup's T12 Profile page: the business's own details, and the one cover photo every branch's page leads with. */
export function ProfileSettingsPage() {
  const owner = useAuthStore((s) => s.owner);
  const accessToken = useAuthStore((s) => s.accessToken) ?? "";
  const { account } = usePermissions();
  const queryClient = useQueryClient();
  const [previewOpen, setPreviewOpen] = useState(false);

  /**
   * Saving the key is a separate step from uploading the bytes, and both
   * live here rather than inside ImageUpload: the component knows how to
   * get a file into storage, and this page knows what that file *is*.
   * Invalidating the permissions query is what refreshes the cover
   * everywhere else it appears, since that is where the account row is
   * read from.
   */
  const saveCover = useMutation({
    mutationFn: (imageKey: string | null) => updateCoverPhoto(accessToken, imageKey),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me", "permissions"] }),
  });

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
        <div className="grid grid-cols-2 gap-4">
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
        </div>
        <Button className="w-fit">Save Changes</Button>
      </section>

      <section
        data-tour="settings-public-profile"
        className="flex flex-col gap-4 border-t border-tn-border-soft pt-6"
      >
        <div className="flex items-center justify-between">
          <p className="m-0 font-sans text-sm font-semibold text-tn-ink">Public Profile</p>
          <Button variant="secondary" size="sm" onClick={() => setPreviewOpen(true)}>
            📱 Preview as Customer
          </Button>
        </div>
        <p className="m-0 -mt-2 font-sans text-xs text-tn-muted-5">
          What customers see on the iGroom app when they find your shop.
        </p>

        <ImageUpload
          purpose="shop-cover"
          accessToken={accessToken}
          currentUrl={account?.coverPhotoUrl ?? null}
          label="Cover photo"
          hint="One photograph for the business — every branch's page leads with it. Landscape works best; 4 MB maximum."
          onUploaded={async (key) => {
            await saveCover.mutateAsync(key);
          }}
          onRemove={async () => {
            await saveCover.mutateAsync(null);
          }}
          disabled={saveCover.isPending}
        />
        {saveCover.isError && (
          <p className="m-0 font-sans text-[11px] text-tn-danger">
            {saveCover.error instanceof Error
              ? saveCover.error.message
              : "Couldn’t save that — try again."}
          </p>
        )}

        {/* The gallery moved, and this is the sentence that says where.
            One business has one cover — that is this page, beside the
            name and the description — but the rooms are not shared:
            Shoreditch and Peckham are different buildings, and a customer
            who opened Peckham's link and saw Shoreditch's window has been
            shown the wrong shop. Each branch keeps its own photographs on
            its own Gallery tab. */}
        <p className="m-0 font-sans text-xs text-tn-muted-6">
          Photos of the shop itself live with the branch they were taken in —{" "}
          <Link to="/locations" className="font-semibold text-tn-ink">
            Locations
          </Link>{" "}
          → a branch → Gallery.
        </p>
      </section>

      <TourTipsCard />

      <PreviewAsCustomerModal open={previewOpen} onClose={() => setPreviewOpen(false)} />
    </div>
  );
}

export default ProfileSettingsPage;
