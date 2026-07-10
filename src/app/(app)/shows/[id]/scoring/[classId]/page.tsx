import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { loadClassDraw } from "@/lib/load-draw";
import { ClassScoringActions } from "@/components/show/class-scoring-actions";
import { ClassStatusBadge } from "@/components/show/class-status-badge";
import { ScoreEntryRow } from "@/components/show/score-entry-row";
import { Card } from "@/components/ui";
import type { Score, ShowClass } from "@/lib/types";

export const metadata = { title: "Class scoring — ShowRing IQ" };

export default async function ClassScoringPage({
  params,
}: {
  params: Promise<{ id: string; classId: string }>;
}) {
  const { id, classId } = await params;
  const { supabase } = await requireUser();

  const { data: cls } = await supabase
    .from("classes")
    .select("*")
    .eq("id", classId)
    .eq("show_id", id)
    .maybeSingle();
  if (!cls) notFound();
  const showClass = cls as ShowClass;

  const [
    drawRows,
    { data: entryClasses },
    { data: scores },
    { data: judgeStaff },
    canEnter,
    canVerify,
    canCorrectUnofficial,
    canCorrectOfficial,
    canFinalize,
  ] = await Promise.all([
    loadClassDraw(supabase, id, classId),
    supabase
      .from("entry_classes")
      .select("id, entry:entries(entry_number, rider_name, horse_name, status)")
      .eq("class_id", classId)
      .eq("status", "entered")
      .order("created_at"),
    supabase.from("scores").select("*").eq("class_id", classId),
    supabase
      .from("show_staff")
      .select("id, display_name")
      .eq("show_id", id)
      .eq("staff_role", "judge"),
    hasOrgPermission(showClass.organization_id, "score.enter"),
    hasOrgPermission(showClass.organization_id, "score.verify"),
    hasOrgPermission(showClass.organization_id, "score.edit_unofficial"),
    hasOrgPermission(showClass.organization_id, "score.correct_official"),
    hasOrgPermission(showClass.organization_id, "score.finalize"),
  ]);

  const scoreByEntryClass = new Map<string, Score>();
  for (const s of (scores as Score[]) ?? []) {
    scoreByEntryClass.set(s.entry_class_id, s);
  }

  const judgeOptions =
    judgeStaff?.map((j) => ({ id: j.id as string, label: j.display_name as string })) ??
    [];

  // Order by draw position when a draw exists; otherwise entry order.
  const drawnIds = new Set(drawRows.map((r) => r.entry_class_id));
  const undrawnEntries =
    entryClasses
      ?.filter((ec) => !drawnIds.has(ec.id as string))
      .map((ec) => ({
        id: ec.id as string,
        entry: ec.entry as unknown as {
          entry_number: number;
          rider_name: string;
          horse_name: string;
          status: string;
        } | null,
      }))
      .filter((ec) => ec.entry?.status === "active") ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          <Link href={`/shows/${id}/scoring`} className="hover:underline">
            Scoring
          </Link>{" "}
          / Class {showClass.class_number}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            Class {showClass.class_number} — {showClass.name}
          </h2>
          <ClassStatusBadge status={showClass.status} />
        </div>
        {showClass.pattern_number && (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Pattern {showClass.pattern_number}
          </p>
        )}
      </div>

      <ClassScoringActions
        classId={classId}
        showId={id}
        classStatus={showClass.status}
        canVerify={canVerify}
        canFinalize={canFinalize}
      />

      <Card>
        <h3 className="mb-4 text-base font-semibold">
          Order of go ({drawRows.length})
        </h3>
        {drawRows.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No draw yet — scoring by entry order below.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {drawRows.map((row) => (
              <li key={row.id} className="py-4">
                <div className="mb-2 flex items-center gap-4">
                  <span className="w-8 text-right font-mono text-sm text-zinc-400">
                    {row.position}
                  </span>
                  <span className="font-mono text-lg font-bold">
                    {row.backNumber ? `#${row.backNumber}` : "—"}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{row.riderName}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {row.horseName}
                    </p>
                  </div>
                </div>
                {row.entryClassStatus === "scratched" ? (
                  <p className="ml-12 text-sm text-red-600 dark:text-red-400">
                    Scratched
                  </p>
                ) : (
                  <div className="ml-12">
                    <ScoreEntryRow
                      entryClassId={row.entry_class_id}
                      score={scoreByEntryClass.get(row.entry_class_id) ?? null}
                      judges={judgeOptions}
                      canEnter={canEnter}
                      canVerify={canVerify}
                      canCorrectUnofficial={canCorrectUnofficial}
                      canCorrectOfficial={canCorrectOfficial}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {undrawnEntries.length > 0 && (
        <Card>
          <h3 className="mb-4 text-base font-semibold">
            Not in draw ({undrawnEntries.length})
          </h3>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {undrawnEntries.map((ec) => (
              <li key={ec.id} className="py-4">
                <div className="mb-2">
                  <p className="text-sm font-medium">{ec.entry?.rider_name}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {ec.entry?.horse_name} · entry {ec.entry?.entry_number}
                  </p>
                </div>
                <ScoreEntryRow
                  entryClassId={ec.id}
                  score={scoreByEntryClass.get(ec.id) ?? null}
                  judges={judgeOptions}
                  canEnter={canEnter}
                  canVerify={canVerify}
                  canCorrectUnofficial={canCorrectUnofficial}
                  canCorrectOfficial={canCorrectOfficial}
                />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
