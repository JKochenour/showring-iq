import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { loadClassDraw } from "@/lib/load-draw";
import {
  AppendToDrawButton,
  DrawMoveButtons,
  GenerateDrawButton,
  RemoveFromDrawButton,
} from "@/components/show/draw-controls";
import { RunStatusBadge } from "@/components/show/run-status-badge";
import { Alert, Card } from "@/components/ui";
import type { Show, ShowClass } from "@/lib/types";

export const metadata = { title: "Class draw — ShowRing IQ" };

export default async function ClassDrawPage({
  params,
}: {
  params: Promise<{ id: string; classId: string }>;
}) {
  const { id, classId } = await params;
  const { supabase } = await requireUser();

  const { data: cls } = await supabase
    .from("classes")
    .select("*, show:shows(status)")
    .eq("id", classId)
    .eq("show_id", id)
    .maybeSingle();
  if (!cls) notFound();
  const showClass = cls as unknown as ShowClass & {
    show: Pick<Show, "status"> | null;
  };
  const showEditable = ["draft", "published"].includes(
    showClass.show?.status ?? "draft"
  );

  const [drawRows, { data: entryClasses }, canSchedule] = await Promise.all([
    loadClassDraw(supabase, id, classId),
    supabase
      .from("entry_classes")
      .select("id, status, entry:entries(id, entry_number, rider_name, horse_name, status)")
      .eq("class_id", classId)
      .eq("status", "entered"),
    hasOrgPermission(showClass.organization_id, "class.schedule"),
  ]);

  const drawnEntryClassIds = new Set(drawRows.map((r) => r.entry_class_id));
  const undrawn =
    entryClasses
      ?.map((ec) => ({
        id: ec.id as string,
        entry: ec.entry as unknown as {
          entry_number: number;
          rider_name: string;
          horse_name: string;
          status: string;
        } | null,
      }))
      .filter(
        (ec) =>
          ec.entry &&
          ec.entry.status === "active" &&
          !drawnEntryClassIds.has(ec.id)
      ) ?? [];

  const manageable = canSchedule && showEditable;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          <Link href={`/shows/${id}/draws`} className="hover:underline">
            Draws
          </Link>{" "}
          / Class {showClass.class_number}
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">
          Class {showClass.class_number} — {showClass.name}
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {drawRows.length} in draw
          {showClass.pattern_number && ` · Pattern ${showClass.pattern_number}`}
          {showClass.drag_every_n && ` · drag every ${showClass.drag_every_n}`}
        </p>
      </div>

      {manageable ? (
        <Card>
          <GenerateDrawButton
            classId={classId}
            hasExistingDraw={drawRows.length > 0}
          />
        </Card>
      ) : (
        !showEditable && (
          <Alert tone="info">
            This show is {showClass.show?.status}; the draw is read-only.
          </Alert>
        )
      )}

      {drawRows.length > 0 && (
        <Card>
          <h3 className="mb-4 text-base font-semibold">Order of go</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  {manageable && <th className="w-10 py-2 pr-2"></th>}
                  <th className="py-2 pr-4 font-medium">Draw</th>
                  <th className="py-2 pr-4 font-medium">Back #</th>
                  <th className="py-2 pr-4 font-medium">Rider / Horse</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  {manageable && <th className="py-2 font-medium"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {drawRows.map((row, index) => (
                  <tr
                    key={row.id}
                    className={
                      row.entryClassStatus === "scratched" ? "opacity-50" : ""
                    }
                  >
                    {manageable && (
                      <td className="py-2 pr-2">
                        <DrawMoveButtons
                          rowId={row.id}
                          isFirst={index === 0}
                          isLast={index === drawRows.length - 1}
                        />
                      </td>
                    )}
                    <td className="py-3 pr-4 font-mono">{row.position}</td>
                    <td className="py-3 pr-4 font-mono font-semibold">
                      {row.backNumber ? `#${row.backNumber}` : "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <p className="font-medium">{row.riderName}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {row.horseName}
                      </p>
                    </td>
                    <td className="py-3 pr-4">
                      <RunStatusBadge status={row.run_status} />
                      {row.entryClassStatus === "scratched" && (
                        <span className="ml-1 text-xs text-red-600 dark:text-red-400">
                          (entry scratched)
                        </span>
                      )}
                    </td>
                    {manageable && (
                      <td className="py-3 text-right">
                        <RemoveFromDrawButton rowId={row.id} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {manageable && undrawn.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-900">
          <h3 className="mb-1 text-base font-semibold">
            Not in draw ({undrawn.length})
          </h3>
          <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
            Entries added after the draw. Late entries go to the end of the
            order (recorded in the audit log).
          </p>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {undrawn.map((ec) => (
              <li
                key={ec.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{ec.entry!.rider_name}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {ec.entry!.horse_name} · entry {ec.entry!.entry_number}
                  </p>
                </div>
                <AppendToDrawButton entryClassId={ec.id} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
