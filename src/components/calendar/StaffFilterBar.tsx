import { useEffect, useMemo, useRef, useState } from "react";
import type { BookingsStaffMember } from "@/lib/bookings-api";
import type { StaffSet, StaffShift } from "@/lib/bookings-api";
import { staffAvatarColor } from "@/lib/staff-avatar-color";

/** "09:00" -> "9 AM", "13:30" -> "1:30 PM" — a pure string formatter (no Date object) since these are plain wall-clock values with no date of their own. */
function formatHHmm(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  let h = Number(hStr);
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return mStr === "00" ? `${h} ${period}` : `${h}:${mStr} ${period}`;
}

function formatShiftRanges(shift: StaffShift | undefined): string {
  if (!shift || shift.isOff || shift.ranges.length === 0) return "Not working today";
  return shift.ranges.map((r) => `${formatHHmm(r.startTime)}–${formatHHmm(r.endTime)}`).join(", ");
}

interface StaffFilterBarProps {
  /** Active roster only — the picker's selectable list. */
  allStaff: BookingsStaffMember[];
  /** The effective selection right now (every active id when nothing's been explicitly chosen yet). */
  selectedStaffIds: readonly string[];
  onApply: (ids: string[]) => void;
  shiftsByStaffId: ReadonlyMap<string, StaffShift>;
  bookingCountByStaffId: ReadonlyMap<string, number>;
  staffSets: StaffSet[];
  onApplySet: (set: StaffSet) => void;
  onCreateSet: (name: string, staffUserIds: string[], isShared: boolean) => void;
  onOpenManageSets: () => void;
  isSaving?: boolean;
}

/**
 * The Day view's staff filter row — "Staff: N of M" opens the picker
 * below it, saved-set chips apply that set in one click, and
 * "+ Save current" opens the small naming dialog. See CalendarPage.tsx
 * for how selectedStaffIds/shiftsByStaffId/bookingCountByStaffId are
 * derived, and ManageStaffSetsModal.tsx for rename/delete/reorder/default.
 */
export function StaffFilterBar({
  allStaff,
  selectedStaffIds,
  onApply,
  shiftsByStaffId,
  bookingCountByStaffId,
  staffSets,
  onApplySet,
  onCreateSet,
  onOpenManageSets,
  isSaving,
}: StaffFilterBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveShared, setSaveShared] = useState(false);
  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<"onShift" | "hasBookings" | "all">("onShift");
  // Local, uncommitted selection while the picker's open — Cancel just
  // closes without touching selectedStaffIds, Apply is what actually
  // calls onApply.
  const [pending, setPending] = useState<Set<string>>(() => new Set(selectedStaffIds));
  const containerRef = useRef<HTMLDivElement>(null);
  const saveNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pickerOpen) setPending(new Set(selectedStaffIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reseed when the picker opens
  }, [pickerOpen]);

  useEffect(() => {
    if (!pickerOpen) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [pickerOpen]);

  // Escape closes whichever overlay is actually on top — the save dialog
  // when it's open (it renders over the picker), otherwise the picker
  // itself — same as the outside-click handler above, just for the
  // keyboard. Neither state is stale here since the effect re-subscribes
  // whenever either one flips.
  useEffect(() => {
    if (!pickerOpen && !saveDialogOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (saveDialogOpen) setSaveDialogOpen(false);
      else setPickerOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [pickerOpen, saveDialogOpen]);

  // Replaces an `autoFocus` prop on the save-name input (jsx-a11y/no-autofocus
  // objects to it outright) — fires exactly when the dialog opens, same as
  // autoFocus would have, since saveDialogOpen only flips true right when
  // the user clicks "+ Save current" / "Save as set…".
  useEffect(() => {
    if (saveDialogOpen) saveNameInputRef.current?.focus();
  }, [saveDialogOpen]);

  const selectedSet = useMemo(() => new Set(selectedStaffIds), [selectedStaffIds]);

  const { onShift, notWorking } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = allStaff.filter((s) => !q || s.name.toLowerCase().includes(q));
    const onShiftList: BookingsStaffMember[] = [];
    const notWorkingList: BookingsStaffMember[] = [];
    for (const member of filtered) {
      const shift = shiftsByStaffId.get(member.id);
      const count = bookingCountByStaffId.get(member.id) ?? 0;
      if (quickFilter === "hasBookings" && count === 0) continue;
      if (shift && !shift.isOff) onShiftList.push(member);
      else notWorkingList.push(member);
    }
    return { onShift: onShiftList, notWorking: notWorkingList };
  }, [allStaff, search, quickFilter, shiftsByStaffId, bookingCountByStaffId]);

  const visibleNotWorking = quickFilter === "onShift" ? [] : notWorking;

  function toggle(id: string) {
    setPending((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const hiddenStaff = allStaff.filter((s) => !selectedSet.has(s.id));
  const hidingOffCount = hiddenStaff.filter((s) => shiftsByStaffId.get(s.id)?.isOff).length;
  const hidingNoBookingsCount = hiddenStaff.filter(
    (s) => !shiftsByStaffId.get(s.id)?.isOff && (bookingCountByStaffId.get(s.id) ?? 0) === 0,
  ).length;

  function renderRow(member: BookingsStaffMember) {
    const isPending = pending.has(member.id);
    const shift = shiftsByStaffId.get(member.id);
    const count = bookingCountByStaffId.get(member.id) ?? 0;
    const inputId = `staff-picker-row-${member.id}`;
    return (
      <label
        key={member.id}
        htmlFor={inputId}
        // Explicit aria-label (not just relying on the nested name span) —
        // that text sits two levels deep (label > flex-col span > truncate
        // span), past label-has-associated-control's default nesting depth,
        // so oxlint doesn't credit it as the label's accessible text.
        aria-label={member.name}
        className={`flex cursor-pointer items-center gap-2.5 rounded-lg p-2 hover:bg-tn-page ${isPending ? "bg-tn-page" : ""}`}
      >
        <input
          id={inputId}
          type="checkbox"
          checked={isPending}
          onChange={() => toggle(member.id)}
          className="h-4 w-4 shrink-0 accent-tn-ink"
        />
        <span
          className="h-6 w-6 shrink-0 rounded-full"
          style={{ background: staffAvatarColor(member.id) }}
        />
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-sans text-[12.5px] font-semibold text-tn-ink">
            {member.name}
          </span>
          <span className="truncate font-sans text-[10.5px] text-tn-muted-5">
            {formatShiftRanges(shift)}
            {count > 0 ? ` · ${count} booked` : ""}
          </span>
        </span>
      </label>
    );
  }

  return (
    <div ref={containerRef} className="relative flex items-center gap-2 flex-wrap py-0.5">
      <button
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        className="flex cursor-pointer items-center gap-2 rounded-full border-none bg-tn-dark px-3.5 py-2 font-sans text-[12.5px] font-semibold text-tn-on-dark"
      >
        Staff: {selectedStaffIds.length} of {allStaff.length}
        <span className="text-[10px]">{pickerOpen ? "▲" : "▾"}</span>
      </button>

      {staffSets.map((set) => {
        const isActive =
          set.staffUserIds.length === selectedStaffIds.length &&
          set.staffUserIds.every((id) => selectedSet.has(id));
        return (
          <button
            key={set.id}
            type="button"
            onClick={() => onApplySet(set)}
            className={`cursor-pointer rounded-full border px-3.5 py-2 font-sans text-[12.5px] font-medium ${
              isActive
                ? "border-transparent bg-tn-blue-bg text-tn-blue"
                : "border-tn-input-border bg-transparent text-tn-muted-1 hover:bg-tn-page"
            }`}
          >
            {set.name}
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => {
          setSaveName("");
          setSaveShared(false);
          setSaveDialogOpen(true);
        }}
        className="cursor-pointer rounded-full border border-dashed border-tn-input-border bg-transparent px-3.5 py-2 font-sans text-[12.5px] font-medium text-tn-muted-5 hover:bg-tn-page"
      >
        + Save current
      </button>

      <button
        type="button"
        onClick={onOpenManageSets}
        className="cursor-pointer border-none bg-transparent px-1 font-sans text-[12.5px] font-medium text-tn-blue"
      >
        Manage sets
      </button>

      <div className="flex-1" />

      {(hidingOffCount > 0 || hidingNoBookingsCount > 0) && (
        <span className="font-sans text-xs text-tn-muted-6">
          {hidingOffCount > 0 ? `Hiding ${hidingOffCount} off today` : ""}
          {hidingOffCount > 0 && hidingNoBookingsCount > 0 ? " · " : ""}
          {hidingNoBookingsCount > 0 ? `${hidingNoBookingsCount} with no bookings` : ""}
        </span>
      )}

      {pickerOpen && (
        // z-30, not z-20 — the Day view's grid header row below is `sticky top-0
        // z-20`, and `position: sticky` opens its own stacking context, so at a
        // *tied* z-index it's the later element in the DOM (the grid header, which
        // renders after this whole component) that wins and paints on top,
        // bleeding through this panel. Needs to clear it outright, not just match it.
        <div className="absolute left-0 top-[46px] z-30 flex w-[352px] flex-col gap-3 rounded-2xl border border-tn-input-border bg-tn-surface p-3.5 shadow-[0_26px_56px_-22px_rgba(40,30,10,0.45)]">
          <div className="flex items-center justify-between">
            <span className="font-sans text-[13.5px] font-semibold text-tn-ink">Staff in view</span>
            <button
              type="button"
              onClick={() => setPending(new Set())}
              className="cursor-pointer border-none bg-transparent font-sans text-xs font-medium text-tn-blue"
            >
              Clear all
            </button>
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff"
            className="rounded-lg border border-tn-input-border bg-tn-page px-3 py-2.5 font-sans text-[13px] text-tn-ink outline-none"
          />

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["onShift", "On shift today"],
                ["hasBookings", "Has bookings"],
                ["all", `All ${allStaff.length}`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setQuickFilter(value)}
                className={`cursor-pointer rounded-full px-2.5 py-1.5 font-sans text-[11.5px] font-medium ${
                  quickFilter === value
                    ? "border-none bg-tn-dark text-tn-on-dark"
                    : "border border-tn-input-border bg-transparent text-tn-muted-1"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex max-h-[280px] flex-col gap-0.5 overflow-y-auto">
            {onShift.length > 0 && (
              <span className="mx-0.5 my-1 font-sans text-[10.5px] font-bold tracking-wider text-tn-muted-6">
                ON SHIFT TODAY
              </span>
            )}
            {onShift.map(renderRow)}
            {visibleNotWorking.length > 0 && (
              <span className="mx-0.5 my-1 mt-2 font-sans text-[10.5px] font-bold tracking-wider text-tn-muted-6">
                NOT WORKING TODAY
              </span>
            )}
            {visibleNotWorking.map(renderRow)}
            {onShift.length === 0 && visibleNotWorking.length === 0 && (
              <span className="p-2 font-sans text-xs text-tn-muted-6">No staff match.</span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2.5 border-t border-tn-border-soft pt-3">
            <button
              type="button"
              onClick={() => {
                setSaveName("");
                setSaveShared(false);
                setSaveDialogOpen(true);
              }}
              className="cursor-pointer border-none bg-transparent font-sans text-xs font-medium text-tn-blue"
            >
              Save as set&hellip;
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="cursor-pointer rounded-lg border border-tn-input-border bg-transparent px-3.5 py-2 font-sans text-xs font-semibold text-tn-muted-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onApply(Array.from(pending));
                  setPickerOpen(false);
                }}
                className="cursor-pointer rounded-lg border-none bg-tn-dark px-3.5 py-2 font-sans text-xs font-semibold text-tn-on-dark"
              >
                Apply &middot; {pending.size}
              </button>
            </div>
          </div>
        </div>
      )}

      {saveDialogOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-tn-backdrop">
          <div className="flex w-[330px] flex-col gap-3.5 rounded-2xl border border-tn-input-border bg-tn-surface p-4 shadow-[0_22px_48px_-22px_rgba(40,30,10,0.42)]">
            <div className="flex flex-col gap-0.5">
              <span className="font-sans text-[13.5px] font-semibold text-tn-ink">
                Save this selection
              </span>
              <span className="font-sans text-[11.5px] text-tn-muted-6">
                {selectedStaffIds.length} people &middot; appears as a chip above the calendar
              </span>
            </div>
            <input
              type="text"
              ref={saveNameInputRef}
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="e.g. Front room"
              className="rounded-lg border border-tn-blue bg-tn-surface px-3 py-2.5 font-sans text-[13px] font-medium text-tn-ink outline-none"
            />
            <label htmlFor="save-set-shared" className="flex items-center gap-2.5">
              <input
                id="save-set-shared"
                type="checkbox"
                checked={saveShared}
                onChange={(e) => setSaveShared(e.target.checked)}
                className="h-4 w-4 accent-tn-ink"
              />
              <span className="font-sans text-xs text-tn-muted-1">Share with other managers</span>
            </label>
            <div className="flex justify-end gap-2 border-t border-tn-border-soft pt-3">
              <button
                type="button"
                onClick={() => setSaveDialogOpen(false)}
                className="cursor-pointer rounded-lg border border-tn-input-border bg-transparent px-3.5 py-2 font-sans text-xs font-semibold text-tn-muted-1"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!saveName.trim() || isSaving}
                onClick={() => {
                  onCreateSet(saveName.trim(), selectedStaffIds.slice(), saveShared);
                  setSaveDialogOpen(false);
                }}
                className="cursor-pointer rounded-lg border-none bg-tn-dark px-3.5 py-2 font-sans text-xs font-semibold text-tn-on-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save set
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StaffFilterBar;
