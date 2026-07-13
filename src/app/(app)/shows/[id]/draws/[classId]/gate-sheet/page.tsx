import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { loadClassDraw } from "@/lib/load-draw";
import { PrintButton } from "@/components/show/print-button";
import type { Show, ShowClass } from "@/lib/types";

export const metadata = { title: "Gate sheet — ShowRing IQ" };

export default async function GateSheetPage({
  params,
}: {
  params: Promise<{ id: string; classId: string }>;
}) {
  const { id, classId } = await params;
  const { supabase } = await requireUser();

  const [{ data: cls }, { data: show }, drawRows] = await Promise.all([
    supabase.from("classes").select("*").eq("id", classId).eq("show_id", id).maybeSingle(),
    supabase.from("shows").select("name, start_date, end_date").eq("id", id).maybeSingle(),
    loadClassDraw(supabase, id, classId),
  ]);

  if (!cls) notFound();
  const showClass = cls as ShowClass;
  const showRow = show as Pick<Show, "name" | "start_date" | "end_date"> | null;
  const runs = drawRows.filter((r) => r.entryClassStatus !== "scratched");
  const scratched = drawRows.filter((r) => r.entryClassStatus === "scratched");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="no-print flex items-center justify-between">
        <p className="text-sm text-stone-500 dark:text-stone-400">Gate sheet</p>
        <PrintButton />
      </div>

      <div className="rounded-lg border border-stone-200 bg-white p-8 text-stone-900 dark:border-stone-800 print:border-0 print:p-0">
        <div className="mb-4 border-b border-stone-300 pb-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            {showRow?.name}
          </p>
          <h1 className="text-xl font-bold">
            Class {showClass.class_number} — {showClass.name}
          </h1>
          <p className="text-sm text-stone-600">Gate sheet · order of go</p>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-300 text-left">
              <th className="py-1.5 pr-3">#</th>
              <th className="py-1.5 pr-3">Back</th>
              <th className="py-1.5 pr-3">Rider</th>
              <th className="py-1.5 pr-3">Horse</th>
              <th className="py-1.5">Owner / Trainer</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {runs.map((r) => (
              <tr key={r.id}>
                <td className="py-1.5 pr-3 font-mono">{r.position}</td>
                <td className="py-1.5 pr-3 font-mono font-bold">
                  {r.backNumber ? `#${r.backNumber}` : "—"}
                </td>
                <td className="py-1.5 pr-3">{r.riderName}</td>
                <td className="py-1.5 pr-3">{r.horseName}</td>
                <td className="py-1.5 text-stone-500">
                  {[r.ownerName, r.trainerName].filter(Boolean).join(" / ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {scratched.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
              Scratched
            </p>
            <p className="text-sm text-stone-500">
              {scratched.map((r) => `${r.riderName} (${r.horseName})`).join(", ")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
