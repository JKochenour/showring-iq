import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { formatCents } from "@/lib/money";
import { ClassStatusBadge } from "@/components/show/class-status-badge";
import { ReorderButtons } from "@/components/show/class-row-actions";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import type { Show, ShowClass } from "@/lib/types";

export const metadata = { title: "Classes — ShowRing IQ" };

export default async function ClassesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: show } = await supabase
    .from("shows")
    .select("id, organization_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!show) notFound();
  const s = show as Pick<Show, "id" | "organization_id" | "status">;

  const [{ data: classes }, canCreate, canEdit] = await Promise.all([
    supabase
      .from("classes")
      .select("*")
      .eq("show_id", id)
      .order("display_order"),
    hasOrgPermission(s.organization_id, "class.create"),
    hasOrgPermission(s.organization_id, "class.edit"),
  ]);

  const rows = (classes as ShowClass[]) ?? [];
  const showEditable = s.status === "draft" || s.status === "published";
  const reorderable = canEdit && showEditable && rows.length > 1;

  return (
    <div>
      <PageHeader
        title="Classes"
        description="Class list in schedule order. Association codes and eligibility plug in with rule packages in a later sprint."
        action={
          canCreate && showEditable ? (
            <ButtonLink href={`/shows/${id}/classes/new`}>Add class</ButtonLink>
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No classes yet"
          description="Add the classes for this show — number, name, fees, and pattern."
          action={
            canCreate && showEditable ? (
              <ButtonLink href={`/shows/${id}/classes/new`}>
                Add class
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  {reorderable && <th className="w-10 py-2 pr-2"></th>}
                  <th className="py-2 pr-4 font-medium">#</th>
                  <th className="py-2 pr-4 font-medium">Class</th>
                  <th className="py-2 pr-4 font-medium">Pattern</th>
                  <th className="py-2 pr-4 font-medium">Entry fee</th>
                  <th className="py-2 pr-4 font-medium">Added money</th>
                  <th className="py-2 pr-4 font-medium">Day</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {rows.map((cls, index) => (
                  <tr key={cls.id}>
                    {reorderable && (
                      <td className="py-2 pr-2">
                        <ReorderButtons
                          classId={cls.id}
                          isFirst={index === 0}
                          isLast={index === rows.length - 1}
                        />
                      </td>
                    )}
                    <td className="py-3 pr-4 font-mono">{cls.class_number}</td>
                    <td className="py-3 pr-4">
                      <Link
                        href={`/shows/${id}/classes/${cls.id}`}
                        className="font-medium text-emerald-700 hover:underline dark:text-emerald-500"
                      >
                        {cls.name}
                      </Link>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {[cls.discipline, cls.division]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </td>
                    <td className="py-3 pr-4">{cls.pattern_number ?? "—"}</td>
                    <td className="py-3 pr-4">
                      {formatCents(cls.entry_fee_cents)}
                    </td>
                    <td className="py-3 pr-4">
                      {cls.added_money_cents > 0
                        ? formatCents(cls.added_money_cents)
                        : "—"}
                    </td>
                    <td className="py-3 pr-4 text-zinc-500 dark:text-zinc-400">
                      {cls.scheduled_date
                        ? new Date(
                            `${cls.scheduled_date}T00:00:00`
                          ).toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="py-3">
                      <ClassStatusBadge status={cls.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
