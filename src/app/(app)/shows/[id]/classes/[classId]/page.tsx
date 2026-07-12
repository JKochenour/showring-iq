import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { EditClassForm } from "@/components/show/class-form";
import { DeleteClassButton } from "@/components/show/class-row-actions";
import { ClassStatusBadge } from "@/components/show/class-status-badge";
import { ClassJudgesManager } from "@/components/show/class-judges-manager";
import { ClassPatternEditor } from "@/components/show/class-pattern-editor";
import { ClassAffiliationsManager } from "@/components/show/class-affiliations-manager";
import { ClassConcurrencyManager } from "@/components/show/class-concurrency-manager";
import { getClassCodeOptions, getClassCodeAffiliationMeta } from "@/lib/rule-package-options";
import { computeFeeCapIssues } from "@/lib/fee-cap";
import { IssueList } from "@/components/show/issue-badges";
import { Alert, Card } from "@/components/ui";
import { formatCents } from "@/lib/money";
import type {
  ClassAffiliationRow,
  ClassJudgeRow,
  ClassPatternRow,
  ShowClass,
} from "@/lib/types";

export const metadata = { title: "Class — ShowRing IQ" };

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string; classId: string }>;
}) {
  const { id, classId } = await params;
  const { supabase } = await requireUser();

  const { data: cls } = await supabase
    .from("classes")
    .select(
      "*, show:shows(status), linked_code:association_class_codes(code, name, max_added_money_cents, max_entry_fee_cents, max_entry_fee_percent_of_added_money, max_entry_fee_jackpot_cents)"
    )
    .eq("id", classId)
    .eq("show_id", id)
    .maybeSingle();
  if (!cls) notFound();

  const showClass = cls as unknown as ShowClass & {
    show: { status: string } | null;
    linked_code: {
      code: string;
      name: string;
      max_added_money_cents: number | null;
      max_entry_fee_cents: number | null;
      max_entry_fee_percent_of_added_money: number | null;
      max_entry_fee_jackpot_cents: number | null;
    } | null;
  };
  const feeCapIssues = computeFeeCapIssues(
    showClass.entry_fee_cents,
    showClass.added_money_cents,
    showClass.linked_code
  );
  const showStatus = showClass.show?.status ?? "draft";
  const showEditable = showStatus === "draft" || showStatus === "published";

  const [
    canEdit,
    canDelete,
    classCodeOptions,
    codeMeta,
    { data: judgeStaff },
    { data: classJudges },
    { data: classAffiliations },
    { data: patternRow },
    { data: showDocuments },
    { data: otherClassesRaw },
  ] = await Promise.all([
    hasOrgPermission(showClass.organization_id, "class.edit"),
    hasOrgPermission(showClass.organization_id, "class.delete"),
    getClassCodeOptions(supabase, showClass.organization_id),
    getClassCodeAffiliationMeta(supabase, showClass.organization_id),
    supabase
      .from("show_staff")
      .select("id, display_name")
      .eq("show_id", id)
      .eq("staff_role", "judge"),
    supabase
      .from("class_judges")
      .select(
        "id, class_id, show_staff_id, assigned_at, show_staff:show_staff(id, display_name, user_id)"
      )
      .eq("class_id", classId)
      .order("assigned_at"),
    supabase
      .from("class_affiliations")
      .select(
        "id, class_id, association_class_code_id, counts_for_money, counts_for_points, counts_for_year_end, is_primary, code:association_class_codes(code, name, rule_package:association_rule_packages(year, version, association:associations(name)))"
      )
      .eq("class_id", classId)
      .order("is_primary", { ascending: false }),
    supabase
      .from("class_patterns")
      .select("id, class_id, pattern_text, pattern_key, document_id, updated_at")
      .eq("class_id", classId)
      .maybeSingle(),
    supabase
      .from("documents")
      .select("id, file_name, document_type")
      .eq("show_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("classes")
      .select("id, class_number, name, concurrent_group_id")
      .eq("show_id", id)
      .neq("id", classId)
      .order("display_order"),
  ]);

  const otherClasses = (otherClassesRaw ?? []).map((c) => ({
    id: c.id as string,
    classNumber: c.class_number as number,
    name: c.name as string,
  }));
  const currentlyConcurrentWith = showClass.concurrent_group_id
    ? (otherClassesRaw ?? [])
        .filter((c) => c.concurrent_group_id === showClass.concurrent_group_id)
        .map((c) => c.id as string)
    : [];

  const judgeOptions =
    judgeStaff?.map((j) => ({ id: j.id as string, label: j.display_name as string })) ??
    [];
  const documentOptions =
    showDocuments?.map((d) => ({
      id: d.id as string,
      label: d.file_name as string,
    })) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          <Link href={`/shows/${id}/classes`} className="hover:underline">
            Classes
          </Link>{" "}
          / Class {showClass.class_number}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            Class {showClass.class_number} — {showClass.name}
          </h2>
          <ClassStatusBadge status={showClass.status} />
        </div>
      </div>

      {feeCapIssues.length > 0 && (
        <Card>
          <IssueList issues={feeCapIssues} />
        </Card>
      )}

      {canEdit && showEditable ? (
        <EditClassForm showClass={showClass} classCodeOptions={classCodeOptions} />
      ) : (
        <Card className="max-w-2xl">
          {!showEditable && (
            <div className="mb-4">
              <Alert tone="info">
                This show is {showStatus}; the class is read-only.
              </Alert>
            </div>
          )}
          <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500 dark:text-stone-400">Discipline</dt>
              <dd>{showClass.discipline ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500 dark:text-stone-400">Division</dt>
              <dd>{showClass.division ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500 dark:text-stone-400">Pattern</dt>
              <dd>{showClass.pattern_number ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500 dark:text-stone-400">Rule package code</dt>
              <dd>
                {showClass.linked_code
                  ? `${showClass.linked_code.code} — ${showClass.linked_code.name}`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500 dark:text-stone-400">Entry fee</dt>
              <dd>{formatCents(showClass.entry_fee_cents)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500 dark:text-stone-400">Added money</dt>
              <dd>{formatCents(showClass.added_money_cents)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500 dark:text-stone-400">Scheduled day</dt>
              <dd>{showClass.scheduled_date ?? "—"}</dd>
            </div>
            {showClass.notes && (
              <div className="flex justify-between gap-4 sm:col-span-2">
                <dt className="text-stone-500 dark:text-stone-400">Notes</dt>
                <dd>{showClass.notes}</dd>
              </div>
            )}
          </dl>
        </Card>
      )}

      <ClassConcurrencyManager
        classId={showClass.id}
        otherClasses={otherClasses}
        currentlyConcurrentWith={currentlyConcurrentWith}
        editable={canEdit && showEditable}
      />

      <ClassAffiliationsManager
        classId={showClass.id}
        affiliations={(classAffiliations as unknown as ClassAffiliationRow[]) ?? []}
        classCodeOptions={classCodeOptions}
        codeMeta={codeMeta}
        editable={canEdit && showEditable}
      />

      <ClassJudgesManager
        classId={showClass.id}
        assignments={(classJudges as unknown as ClassJudgeRow[]) ?? []}
        judgeOptions={judgeOptions}
        editable={canEdit && showEditable}
      />

      <ClassPatternEditor
        classId={showClass.id}
        pattern={(patternRow as ClassPatternRow | null) ?? null}
        documentOptions={documentOptions}
        editable={canEdit && showEditable}
      />

      {canDelete && showEditable && (
        <Card className="max-w-2xl border-red-200 dark:border-red-900">
          <h3 className="mb-1 text-sm font-semibold">Danger zone</h3>
          <p className="mb-3 text-sm text-stone-500 dark:text-stone-400">
            Deleting a class removes it from the schedule. Once entries exist
            for it, cancel the class instead.
          </p>
          <DeleteClassButton
            classId={showClass.id}
            label={`Class ${showClass.class_number} — ${showClass.name}`}
          />
        </Card>
      )}
    </div>
  );
}
