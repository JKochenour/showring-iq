"use client";

import { useState, useTransition } from "react";
import { setRulePackageStatus } from "@/app/(app)/organizations/[id]/rule-packages/actions";
import { Button } from "@/components/ui";
import { useConfirmDialog } from "@/components/confirm-dialog";
import type { RulePackageStatus } from "@/lib/types";

const NEXT_STEPS: Partial<Record<RulePackageStatus, { status: RulePackageStatus; label: string }[]>> = {
  draft: [{ status: "review", label: "Send to review" }],
  review: [
    { status: "tested", label: "Mark tested" },
    { status: "draft", label: "Back to draft" },
  ],
  tested: [
    { status: "published", label: "Publish" },
    { status: "review", label: "Back to review" },
  ],
  published: [{ status: "deprecated", label: "Deprecate" }],
  deprecated: [{ status: "published", label: "Republish" }],
  archived: [{ status: "draft", label: "Restore to draft" }],
};

export function RulePackageStatusActions({
  packageId,
  organizationId,
  status,
  canPublish,
}: {
  packageId: string;
  organizationId: string;
  status: RulePackageStatus;
  canPublish: boolean;
}) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const confirm = useConfirmDialog();

  if (!canPublish) return null;
  const steps = NEXT_STEPS[status] ?? [];

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {steps.map((step) => (
          <Button
            key={step.status}
            variant="secondary"
            disabled={isPending}
            onClick={() => {
              setError(undefined);
              startTransition(async () => {
                const result = await setRulePackageStatus(
                  packageId,
                  step.status,
                  organizationId
                );
                if (result?.error) setError(result.error);
              });
            }}
          >
            {isPending ? "…" : step.label}
          </Button>
        ))}
        {status !== "archived" && (
          <Button
            variant="danger"
            disabled={isPending}
            onClick={async () => {
              const result = await confirm({
                title: "Archive rule package",
                message: "Archive this rule package?",
                tone: "danger",
                confirmLabel: "Archive",
              });
              if (!result) return;
              setError(undefined);
              startTransition(async () => {
                const result = await setRulePackageStatus(
                  packageId,
                  "archived",
                  organizationId
                );
                if (result?.error) setError(result.error);
              });
            }}
          >
            Archive
          </Button>
        )}
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
