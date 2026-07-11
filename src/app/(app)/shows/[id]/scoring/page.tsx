import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { ClassStatusBadge } from "@/components/show/class-status-badge";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import type { ShowClass } from "@/lib/types";

export const metadata = { title: "Scoring — ShowRing IQ" };

export default async function ScoringPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user } = await requireUser();

  const { data: show } = await supabase
    .from("shows")
    .select("id, organization_id")
    .eq("id", id)
    .maybeSingle();
  if (!show) notFound();

  // Office staff (score.edit_unofficial) see every class, as today.
  // Judge-only actors (score.enter without the office override) only
  // see classes they're assigned to via class_judges.
  const [isOfficeStaff, { data: assignedClassIds }] = await Promise.all([
    hasOrgPermission(show.organization_id, "score.edit_unofficial"),
    supabase
      .from("class_judges")
      .select("class_id, show_staff:show_staff!inner(user_id)")
      .eq("show_id", id)
      .eq("show_staff.user_id", user.id),
  ]);
  const assignedIds = new Set(
    (assignedClassIds ?? []).map((r) => r.class_id as string)
  );

  const [{ data: classes }, { data: entryClasses }, { data: scores }] =
    await Promise.all([
      supabase
        .from("classes")
        .select("*")
        .eq("show_id", id)
        .not("status", "in", "(draft,open,entry_closed,cancelled,archived)")
        .order("display_order"),
      supabase
        .from("entry_classes")
        .select("class_id, status")
        .eq("show_id", id)
        .eq("status", "entered"),
      supabase.from("scores").select("class_id, status").eq("show_id", id),
    ]);

  const allRows = (classes as ShowClass[]) ?? [];
  const rows = isOfficeStaff
    ? allRows
    : allRows.filter((c) => assignedIds.has(c.id));

  const enteredByClass = new Map<string, number>();
  for (const ec of entryClasses ?? []) {
    enteredByClass.set(ec.class_id, (enteredByClass.get(ec.class_id) ?? 0) + 1);
  }
  const verifiedByClass = new Map<string, number>();
  const scoredByClass = new Map<string, number>();
  for (const s of scores ?? []) {
    scoredByClass.set(s.class_id, (scoredByClass.get(s.class_id) ?? 0) + 1);
    if (s.status === "verified") {
      verifiedByClass.set(s.class_id, (verifiedByClass.get(s.class_id) ?? 0) + 1);
    }
  }

  return (
    <div>
      <PageHeader
        title="Scoring"
        description="Classes with a draw. Judges and secretaries enter scores here; the secretary verifies before the class becomes official."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No classes ready for scoring"
          description="Generate a draw for a class first — scoring opens once a class is drawn or running."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500 dark:border-stone-800 dark:text-stone-400">
                  <th className="py-2 pr-4 font-medium">#</th>
                  <th className="py-2 pr-4 font-medium">Class</th>
                  <th className="py-2 pr-4 font-medium">Entered</th>
                  <th className="py-2 pr-4 font-medium">Scored</th>
                  <th className="py-2 pr-4 font-medium">Verified</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                {rows.map((cls) => (
                  <tr key={cls.id}>
                    <td className="py-3 pr-4 font-mono">{cls.class_number}</td>
                    <td className="py-3 pr-4">
                      <Link
                        href={`/shows/${id}/scoring/${cls.id}`}
                        className="font-medium text-brand-700 hover:underline dark:text-brand-500"
                      >
                        {cls.name}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">{enteredByClass.get(cls.id) ?? 0}</td>
                    <td className="py-3 pr-4">{scoredByClass.get(cls.id) ?? 0}</td>
                    <td className="py-3 pr-4">{verifiedByClass.get(cls.id) ?? 0}</td>
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
