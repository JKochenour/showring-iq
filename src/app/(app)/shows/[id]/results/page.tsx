import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { ClassStatusBadge } from "@/components/show/class-status-badge";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import type { ShowClass } from "@/lib/types";

export const metadata = { title: "Results — ShowRing IQ" };

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: show } = await supabase
    .from("shows")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!show) notFound();

  const { data: classes } = await supabase
    .from("classes")
    .select("*")
    .eq("show_id", id)
    .in("status", ["official", "results_posted", "exported"])
    .order("display_order");

  const rows = (classes as ShowClass[]) ?? [];

  return (
    <div>
      <PageHeader
        title="Results"
        description="Placings calculated from verified scores. Tie handling v1: ties stand (standard competition ranking). A class must be marked official on the Scoring tab before results can be calculated."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No official classes yet"
          description="Finish scoring and mark a class official to see it here."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="py-2 pr-4 font-medium">#</th>
                  <th className="py-2 pr-4 font-medium">Class</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {rows.map((cls) => (
                  <tr key={cls.id}>
                    <td className="py-3 pr-4 font-mono">{cls.class_number}</td>
                    <td className="py-3 pr-4">
                      <Link
                        href={`/shows/${id}/results/${cls.id}`}
                        className="font-medium text-emerald-700 hover:underline dark:text-emerald-500"
                      >
                        {cls.name}
                      </Link>
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
