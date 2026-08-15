import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { SeatUpgradeModal } from "@/components/settings/SeatUpgradeModal";
import { AddMemberWizard } from "@/components/settings/AddMemberWizard";
import { STAFF } from "@/lib/sample-data";

const ROLE_COUNT = 4;

/** Matches the mockup's T12g2 Staff Management table + the T12g2→h–l "New Member" flow. */
export function StaffManagementPage() {
  const [seatModalOpen, setSeatModalOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  function handleNewMember() {
    setSeatModalOpen(true);
  }

  function handleUpgrade() {
    setSeatModalOpen(false);
    setWizardOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="m-0 font-sans text-2xl font-semibold text-tn-ink">Staff Management</h1>
        <Button onClick={handleNewMember}>+ New Member</Button>
      </div>

      <div className="flex gap-5 font-sans text-[13px] font-medium text-tn-muted-3">
        <span>
          Members <span className="font-semibold text-tn-ink">{STAFF.length}</span>
        </span>
        <span>
          Roles <span className="font-semibold text-tn-ink">{ROLE_COUNT}</span>
        </span>
      </div>

      <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border">
        <div className="grid grid-cols-[1.8fr_1fr_1.2fr_0.8fr_0.8fr] bg-tn-table-head px-[18px] py-3 font-sans text-xs font-semibold text-tn-muted-5">
          <span>Name</span>
          <span>Role</span>
          <span>Location</span>
          <span>Status</span>
          <span>Shortcuts</span>
        </div>
        {STAFF.map((member, i) => (
          <div
            key={member.id}
            className={`grid grid-cols-[1.8fr_1fr_1.2fr_0.8fr_0.8fr] items-center px-[18px] py-3.5 ${
              i < STAFF.length - 1 ? "border-b border-tn-border-soft" : ""
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Avatar initials={member.initials} color={member.avatarColor} size={28} />
              <span>
                <p className="m-0 font-sans text-[13px] font-semibold text-tn-ink">{member.name}</p>
                <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">{member.email}</p>
              </span>
            </span>
            <span className="font-sans text-[13px] text-tn-muted-2">{member.role}</span>
            <span className="font-sans text-[13px] text-tn-muted-2">{member.location}</span>
            <StatusPill tone={member.status === "Active" ? "success" : "gold"}>
              {member.status}
            </StatusPill>
            <span className="flex gap-2 font-sans text-tn-muted-5">
              <span title="Edit profile" className="cursor-pointer">
                ✎
              </span>
              <span title="More shortcuts" className="cursor-pointer">
                ⋮
              </span>
            </span>
          </div>
        ))}
      </div>

      <p className="m-0 font-sans text-xs text-tn-muted-6">
        ✎ opens the profile edit. ⋮ opens services, schedule, role &amp; permissions, and other
        options — changed less often.
      </p>

      <SeatUpgradeModal
        open={seatModalOpen}
        onClose={() => setSeatModalOpen(false)}
        onUpgrade={handleUpgrade}
      />
      <AddMemberWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}

export default StaffManagementPage;
