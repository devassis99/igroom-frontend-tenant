import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { formInputClass } from "@/components/ui/FormField";
import {
  createCategory,
  deleteCategory,
  listCategories,
  renameCategory,
  type ServiceCategory,
} from "@/lib/services-api";

interface CategoriesModalProps {
  open: boolean;
  onClose: () => void;
  accessToken: string;
}

/**
 * T9's "Categories" toolbar button opens this. The mockup doesn't design
 * a dedicated frame for it — deliberate call-out, same as
 * AppShell.tsx/IntegrationsModal.tsx's notes on undesigned-but-implied
 * screens — so this is a minimal rename/add/delete list rather than a
 * pixel-matched frame. Deleting a category un-categorizes its services
 * rather than deleting them (see services.service.ts's deleteCategory).
 */
export function CategoriesModal({ open, onClose, accessToken }: CategoriesModalProps) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [pendingDelete, setPendingDelete] = useState<ServiceCategory | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["service-categories"],
    queryFn: () => listCategories(accessToken),
    enabled: open && !!accessToken,
  });
  const categories = categoriesQuery.data?.categories ?? [];

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["service-categories"] });
    // A renamed/deleted category's name is denormalized onto every
    // service row (see services.service.ts's categoryName), so the
    // Services table needs to refetch too.
    queryClient.invalidateQueries({ queryKey: ["services"] });
  }

  const createMutation = useMutation({
    mutationFn: () => createCategory(accessToken, newName.trim()),
    onSuccess: () => {
      setNewName("");
      setFormError(null);
      invalidate();
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : "Couldn't add that category.");
    },
  });

  const renameMutation = useMutation({
    mutationFn: (categoryId: string) => renameCategory(accessToken, categoryId, renameValue.trim()),
    onSuccess: () => {
      setRenamingId(null);
      invalidate();
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : "Couldn't rename that category.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (categoryId: string) => deleteCategory(accessToken, categoryId),
    onSuccess: () => {
      setPendingDelete(null);
      invalidate();
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : "Couldn't delete that category.");
    },
  });

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    createMutation.mutate();
  }

  function startRename(category: ServiceCategory) {
    setRenamingId(category.id);
    setRenameValue(category.name);
  }

  function submitRename(e: FormEvent) {
    e.preventDefault();
    if (!renamingId || !renameValue.trim()) return;
    renameMutation.mutate(renamingId);
  }

  return (
    <>
      <Modal open={open} onClose={onClose} width={440}>
        <div className="flex items-center justify-between px-6 pt-6">
          <h2 className="m-0 font-sans text-xl font-semibold text-tn-ink">Categories</h2>
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
          {categoriesQuery.isPending && (
            <p className="m-0 font-sans text-sm text-tn-muted-5">Loading categories…</p>
          )}
          {!categoriesQuery.isPending && categories.length === 0 && (
            <p className="m-0 font-sans text-sm text-tn-muted-5">
              No categories yet — add one below.
            </p>
          )}

          <div className="flex flex-col gap-1">
            {categories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between gap-2 rounded-xl px-2 py-2 hover:bg-tn-page"
              >
                {renamingId === category.id ? (
                  <form onSubmit={submitRename} className="flex flex-1 items-center gap-2">
                    <input
                      // eslint-disable-next-line jsx-a11y/no-autofocus -- this input only exists because the user just clicked "Rename" a moment ago; moving focus to it is the expected continuation of that action, not a surprise on page load.
                      autoFocus
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className={`${formInputClass} flex-1 py-2`}
                    />
                    <Button type="submit" size="sm" disabled={renameMutation.isPending}>
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setRenamingId(null)}
                    >
                      Cancel
                    </Button>
                  </form>
                ) : (
                  <>
                    <span className="font-sans text-sm text-tn-ink-soft">{category.name}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startRename(category)}
                        className="cursor-pointer rounded-lg border-none bg-transparent px-2 py-1 font-sans text-xs font-semibold text-tn-gold"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(category)}
                        aria-label={`Delete ${category.name}`}
                        className="cursor-pointer rounded-lg border-none bg-transparent px-2 py-1 font-sans text-xs font-semibold text-tn-danger"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <form
            onSubmit={handleAdd}
            className="flex items-center gap-2 border-t border-tn-border-soft pt-4"
          >
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New category name"
              className={`${formInputClass} flex-1`}
            />
            <Button type="submit" disabled={createMutation.isPending || !newName.trim()}>
              Add
            </Button>
          </form>

          {formError && <p className="m-0 font-sans text-xs text-tn-danger">{formError}</p>}
        </div>
      </Modal>

      <ConfirmModal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
        title={`Delete “${pendingDelete?.name}”?`}
        body="Services in this category won't be deleted — they'll just show no category until you re-assign them."
        confirmLabel="Delete category"
        confirming={deleteMutation.isPending}
      />
    </>
  );
}

export default CategoriesModal;
