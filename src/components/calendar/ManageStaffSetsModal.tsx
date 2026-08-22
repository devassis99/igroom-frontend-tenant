import { useEffect, useRef, useState } from "react";
import type { StaffSet } from "@/lib/bookings-api";

interface ManageStaffSetsModalProps {
  open: boolean;
  onClose: () => void;
  staffSets: StaffSet[];
  onRename: (staffSetId: string, name: string) => void;
  onDelete: (staffSetId: string) => void;
  onSetDefault: (staffSetId: string, isDefault: boolean) => void;
  onToggleShared: (staffSetId: string, isShared: boolean) => void;
  onReorder: (staffSetIds: string[]) => void;
}

/**
 * "Manage sets" — reached from StaffFilterBar's own link, or (once member
 * editing is needed rather than just rename/delete/reorder) reopening the
 * picker's "Save as set..." flow on an existing set. Reorder is up/down
 * buttons rather than pointer drag — same end result (persists a full
 * order via onReorder, see reorderStaffSets in bookings.service.ts) with
 * far less code and no extra drag-and-drop dependency.
 */
export function ManageStaffSetsModal({
  open,
  onClose,
  staffSets,
  onRename,
  onDelete,
  onSetDefault,
  onToggleShared,
  onReorder,
}: ManageStaffSetsModalProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Replaces an `autoFocus` prop (flagged by jsx-a11y/no-autofocus, which
  // objects to autofocusing on mount/update regardless of user intent) —
  // this only fires when renamingId actually changes to a real id, i.e.
  // right when the user clicks "Rename", so the behavior is identical.
  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  if (!open) return null;

  function move(index: number, direction: -1 | 1) {
    const next = staffSets.map((s) => s.id);
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    onReorder(next);
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-tn-backdrop"
      onClick={onClose}
      role="presentation"
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- onClick here only stops the backdrop's onClose from firing when the panel itself is clicked, not a real interactive control — same pattern as Modal.tsx's own backdrop. */}
      <div
        // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- swapping to native <dialog> needs a focus-trap rework of this call site, deferred (matches Modal.tsx's own inner panel).
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="flex w-[420px] flex-col gap-3 rounded-2xl border border-tn-input-border bg-tn-surface p-4 shadow-[0_22px_48px_-22px_rgba(40,30,10,0.42)]"
      >
        <div className="flex items-center justify-between">
          <span className="font-sans text-[13.5px] font-semibold text-tn-ink">Saved sets</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer border-none bg-transparent font-sans text-[13px] font-medium text-tn-muted-1"
          >
            Done
          </button>
        </div>

        <div className="flex max-h-[360px] flex-col gap-1.5 overflow-y-auto">
          {staffSets.length === 0 && (
            <span className="p-2 font-sans text-xs text-tn-muted-6">
              No saved sets yet — use "+ Save current" above the calendar to create one.
            </span>
          )}
          {staffSets.map((set, index) => (
            <div
              key={set.id}
              className="flex items-center gap-2.5 rounded-lg border border-tn-border-soft p-2.5"
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label="Move up"
                  className="cursor-pointer border-none bg-transparent p-0 text-[10px] leading-none text-tn-muted-5 disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  type="button"
                  disabled={index === staffSets.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label="Move down"
                  className="cursor-pointer border-none bg-transparent p-0 text-[10px] leading-none text-tn-muted-5 disabled:opacity-30"
                >
                  ▼
                </button>
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                {renamingId === set.id ? (
                  <input
                    type="text"
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && renameValue.trim()) {
                        onRename(set.id, renameValue.trim());
                        setRenamingId(null);
                      }
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    onBlur={() => {
                      if (renameValue.trim() && renameValue.trim() !== set.name) {
                        onRename(set.id, renameValue.trim());
                      }
                      setRenamingId(null);
                    }}
                    className="rounded-md border border-tn-blue bg-tn-surface px-2 py-1 font-sans text-[12.5px] font-semibold text-tn-ink outline-none"
                  />
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-sans text-[12.5px] font-semibold text-tn-ink">
                      {set.name}
                    </span>
                    {set.isDefault && (
                      <span className="shrink-0 rounded-full bg-tn-success-bg px-1.5 py-0.5 font-sans text-[9.5px] font-bold tracking-wide text-tn-success">
                        DEFAULT
                      </span>
                    )}
                  </span>
                )}
                <span className="font-sans text-[11px] text-tn-muted-5">
                  {set.staffUserIds.length} people &middot; {set.isShared ? "shared" : "private"}
                </span>
              </div>

              <div className="flex shrink-0 gap-2.5 font-sans text-[11.5px] font-medium text-tn-muted-4">
                <button
                  type="button"
                  onClick={() => {
                    setRenamingId(set.id);
                    setRenameValue(set.name);
                  }}
                  className="cursor-pointer border-none bg-transparent p-0"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => onSetDefault(set.id, !set.isDefault)}
                  className="cursor-pointer border-none bg-transparent p-0"
                >
                  {set.isDefault ? "Unset default" : "Set default"}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleShared(set.id, !set.isShared)}
                  className="cursor-pointer border-none bg-transparent p-0"
                >
                  {set.isShared ? "Make private" : "Share"}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(set.id)}
                  className="cursor-pointer border-none bg-transparent p-0 text-tn-danger-strong"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ManageStaffSetsModal;
