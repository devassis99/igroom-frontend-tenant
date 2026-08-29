import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/auth/auth-store";
import { ApiError } from "@/lib/http";
import { getTipRule, posKeys, saveTipRule, type PosTipRole } from "@/lib/pos-api";

/**
 * How the shop splits a tip. Set once, applied to every ticket.
 *
 * The percentages must add up to exactly 100 and the dialog says so
 * before the save rather than after: a rule that does not add up is the
 * one bug here that would quietly lose people money, and finding out
 * from a 400 is worse than being told while you type.
 *
 * Editing this changes what *future* tickets do. Splits already written
 * onto closed tickets stay exactly as they were — see TipSplit.
 */

const ROLES: { role: PosTipRole; label: string; hint: string }[] = [
  { role: "chair", label: "Chair", hint: "Whoever performed the service" },
  { role: "assist", label: "Assist", hint: "Credited on the ticket when someone assisted" },
  { role: "desk", label: "Front desk", hint: "Pooled and shared nightly" },
];

function errorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) return error.message;
  return "Something went wrong. Try again.";
}

interface TipRuleEditorProps {
  open: boolean;
  onClose: () => void;
  locationId: string;
}

export function TipRuleEditor({ open, onClose, locationId }: TipRuleEditorProps) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();
  /**
   * Null until somebody edits, and the fields then show the saved rule.
   * Derived rather than copied into state by an effect — an effect here
   * would also stamp over what the user is typing the moment the query
   * refetched underneath them.
   */
  const [draft, setDraft] = useState<Record<PosTipRole, number> | null>(null);

  const ruleQuery = useQuery({
    queryKey: posKeys.tipRule(locationId),
    queryFn: () => getTipRule(accessToken ?? "", locationId),
    enabled: Boolean(open && accessToken && locationId),
  });

  const saved = useMemo<Record<PosTipRole, number>>(() => {
    const next: Record<PosTipRole, number> = { chair: 100, assist: 0, desk: 0 };
    if (!ruleQuery.data) return next;
    next.chair = 0;
    for (const share of ruleQuery.data.shares) next[share.role] = share.bps / 100;
    return next;
  }, [ruleQuery.data]);

  const percents = draft ?? saved;
  const setPercents = (
    update: (current: Record<PosTipRole, number>) => Record<PosTipRole, number>,
  ) => setDraft(update(percents));

  const dismiss = () => {
    // Drop the edit on the way out so reopening shows what is saved
    // rather than an abandoned draft.
    setDraft(null);
    onClose();
  };

  const total = ROLES.reduce((sum, { role }) => sum + (percents[role] || 0), 0);
  const balanced = total === 100;

  const save = useMutation({
    mutationFn: () =>
      saveTipRule(accessToken ?? "", {
        // Saved against the branch, so a shop where one site splits
        // differently is a second row rather than an argument.
        locationId,
        name: ROLES.filter(({ role }) => percents[role] > 0)
          .map(({ role, label }) => `${label} ${percents[role]}`)
          .join(" / "),
        shares: ROLES.filter(({ role }) => percents[role] > 0).map(({ role }) => ({
          role,
          bps: Math.round(percents[role] * 100),
        })),
      }),
    onSuccess: (rule) => {
      queryClient.setQueryData(posKeys.tipRule(locationId), rule);
      setDraft(null);
      onClose();
    },
  });

  const notice = errorMessage(save.error);

  return (
    <Modal open={open} onClose={dismiss} width={460}>
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="m-0 font-serif text-xl font-semibold text-tn-ink">Tip split rule</h2>
          <p className="m-0 mt-1 font-sans text-[12px] leading-relaxed text-tn-muted-3">
            Applied to every ticket at this branch. Tickets already closed keep the split they were
            given.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {ROLES.map(({ role, label, hint }) => (
            <label key={role} className="flex items-center gap-3">
              <span className="flex-1">
                <span className="block font-sans text-[13px] font-semibold text-tn-ink">
                  {label}
                </span>
                <span className="block font-sans text-[11px] text-tn-muted-3">{hint}</span>
              </span>
              <input
                value={String(percents[role] ?? 0)}
                onChange={(event) => {
                  const value = Number.parseInt(event.target.value.replace(/\D/g, ""), 10);
                  setPercents((current) => ({
                    ...current,
                    [role]: Number.isFinite(value) ? Math.min(100, value) : 0,
                  }));
                }}
                inputMode="numeric"
                aria-label={`${label} percentage`}
                className="w-[68px] rounded-lg border border-tn-input-border bg-transparent px-3 py-2 text-right font-sans text-[13px] font-semibold text-tn-ink outline-none"
              />
              <span className="w-3 font-sans text-[13px] text-tn-muted-3">%</span>
            </label>
          ))}
        </div>

        <div
          className={`flex items-center justify-between rounded-lg px-3.5 py-2.5 ${
            balanced ? "bg-tn-success-bg" : "bg-tn-danger-bg"
          }`}
        >
          <span
            className={`font-sans text-[12px] font-medium ${balanced ? "text-tn-success" : "text-tn-danger"}`}
          >
            {balanced ? "Adds up" : `Must add up to 100% — currently ${total}%`}
          </span>
          <span
            className={`font-sans text-[13px] font-semibold ${balanced ? "text-tn-success" : "text-tn-danger"}`}
          >
            {total}%
          </span>
        </div>

        {notice && (
          <p className="m-0 rounded-lg border border-tn-danger bg-tn-danger-bg px-3 py-2 font-sans text-[12px] text-tn-danger">
            {notice}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={dismiss}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={!balanced || save.isPending}>
            Save rule
          </Button>
        </div>
      </div>
    </Modal>
  );
}
