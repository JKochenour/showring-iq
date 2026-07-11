import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { EditClassForm } from "@/components/show/class-form";
import { DeleteClassButton } from "@/components/show/class-row-actions";
import { ClassStatusBadge } from "@/components/show/class-status-badge";
import { ClassJudgesManager } from "@/components/show/class-judges-manager";
import { ClassPatternEditor } from "@/components/show/class-pattern-editor";
import { getClassCodeOptions } from "@/lib/rule-package-options";
import { Alert, Card } from "@/components/ui";
import { formatCents } from "@/lib/money";
import type { ClassJudgeRow, ClassPatternRow, ShowClass } from "@/lib/types";

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
    .select("*, show:shows(status), linked_code:association_class_codes(code, name)")
    .eq("id", classId)
    .eq("show_id", id)
    .maybeSingle();
  if (!cls) notFound();

  const showClass = cls as unknown as ShowClass & {
    show: { status: string } | null;
    linked_code: { code: string; name: string } | null;
  };
  const showStatus = showClass.show?.status ?? "draft";
  const showEditable = showStatus === "draft" || showStatus === "published";

  const [
    canEdit,
    canDelete,
    classCodeOptions,
    { data: judgeStaff },
    { data: classJudges },
    { data: patternRow },
    { data: showDocuments },
  ] = await Promise.all([
    hasOrgPermission(showClass.organization_id, "class.edit"),
    hasOrgPermission(showClass.organization_id, "class.delete"),
    getClassCodeOptions(supabase, showClass.organization_id),
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
      .from("class_patterns")
      .select("id, class_id, pattern_text, document_id, updated_at")
      .eq("class_id", classId)
      .maybeSingle(),
    supabase
      .from("documents")
      .select("id, file_name, document_type")
      .eq("show_id", id)
      .order("created_at", { ascending: false }),
  ]);

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
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
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
              <dt className="text-zinc-500 dark:text-zinc-400">Discipline</dt>
              <dd>{showClass.discipline ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500 dark:text-zinc-400">Division</dt>
              <dd>{showClass.division ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500 dark:text-zinc-400">Pattern</dt>
              <dd>{showClass.pattern_number ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500 dark:text-zinc-400">Rule package code</dt>
              <dd>
                {showClass.linked_code
                  ? `${showClass.linked_code.code} — ${showClass.linked_code.name}`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500 dark:text-zinc-400">Entry fee</dt>
              <dd>{formatCents(showClass.entry_fee_cents)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500 dark:text-zinc-400">Added money</dt>
              <dd>{formatCents(showClass.added_money_cents)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500 dark:text-zinc-400">Scheduled day</dt>
              <dd>{showClass.scheduled_date ?? "—"}</dd>
            </div>
            {showClass.notes && (
              <div className="flex justify-between gap-4 sm:col-span-2">
                <dt className="text-zinc-500 dark:text-zinc-400">Notes</dt>
                <dd>{showClass.notes}</dd>
              </div>
            )}
          </dl>
        </Card>
      )}

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
          <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
            Deleting a class removes it from the schedule. Once entries exist
            (Sprint 5), cancel the class instead.
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
