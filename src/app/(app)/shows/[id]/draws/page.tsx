import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { ClassStatusBadge } from "@/components/show/class-status-badge";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import type { ShowClass } from "@/lib/types";

export const metadata = { title: "Draws — ShowRing IQ" };

export default async function DrawsPage({
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

  const [{ data: classes }, { data: entryClasses }, { data: drawRows }] =
    await Promise.all([
      supabase
        .from("classes")
        .select("*")
        .eq("show_id", id)
        .not("status", "in", "(cancelled,archived)")
        .order("display_order"),
      supabase
        .from("entry_classes")
        .select("class_id, status")
        .eq("show_id", id)
        .eq("status", "entered"),
      supabase.from("class_draws").select("class_id").eq("show_id", id),
    ]);

  const rows = (classes as ShowClass[]) ?? [];

  const enteredByClass = new Map<string, number>();
  for (const ec of entryClasses ?? []) {
    enteredByClass.set(ec.class_id, (enteredByClass.get(ec.class_id) ?? 0) + 1);
  }
  const drawnByClass = new Map<string, number>();
  for (const dr of drawRows ?? []) {
    drawnByClass.set(dr.class_id, (drawnByClass.get(dr.class_id) ?? 0) + 1);
  }

  return (
    <div>
      <PageHeader
        title="Draws"
        description="Order of go per class. Draws use a seeded shuffle with rider spacing; re-draws are recorded in the audit log."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No classes"
          description="Add classes to the show first, then generate draws."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="py-2 pr-4 font-medium">#</th>
                  <th className="py-2 pr-4 font-medium">Class</th>
                  <th className="py-2 pr-4 font-medium">Entered</th>
                  <th className="py-2 pr-4 font-medium">In draw</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {rows.map((cls) => {
                  const entered = enteredByClass.get(cls.id) ?? 0;
                  const drawn = drawnByClass.get(cls.id) ?? 0;
                  return (
                    <tr key={cls.id}>
                      <td className="py-3 pr-4 font-mono">{cls.class_number}</td>
                      <td className="py-3 pr-4">
                        <Link
                          href={`/shows/${id}/draws/${cls.id}`}
                          className="font-medium text-emerald-700 hover:underline dark:text-emerald-500"
                        >
                          {cls.name}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">{entered}</td>
                      <td className="py-3 pr-4">
                        {drawn > 0 ? (
                          drawn
                        ) : (
                          <span className="text-zinc-400">no draw</span>
                        )}
                        {drawn > 0 && drawn < entered && (
                          <span className="ml-1 text-xs text-amber-700 dark:text-amber-400">
                            ({entered - drawn} not drawn)
                          </span>
                        )}
                      </td>
                      <td className="py-3">
                        <ClassStatusBadge status={cls.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
