import { Fragment } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { loadClassDraw } from "@/lib/load-draw";
import { getNrhaPattern } from "@/lib/nrha-patterns";
import { PrintButton } from "@/components/show/print-button";
import type { ClassPatternRow, Show, ShowClass } from "@/lib/types";

export const metadata = { title: "Scribe score sheet — ShowRing IQ" };

const ROWS_PER_PAGE = 10;

function chunk<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [[]];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}

export default async function ScoreSheetPage({
  params,
}: {
  params: Promise<{ id: string; classId: string }>;
}) {
  const { id, classId } = await params;
  const { supabase } = await requireUser();

  const [{ data: cls }, { data: show }, drawRows, { data: patternRow }, { data: classJudges }] =
    await Promise.all([
      supabase.from("classes").select("*").eq("id", classId).eq("show_id", id).maybeSingle(),
      supabase.from("shows").select("name, start_date, end_date").eq("id", id).maybeSingle(),
      loadClassDraw(supabase, id, classId),
      supabase
        .from("class_patterns")
        .select("id, class_id, pattern_text, pattern_key, document_id, updated_at")
        .eq("class_id", classId)
        .maybeSingle(),
      supabase
        .from("class_judges")
        .select("show_staff:show_staff(display_name)")
        .eq("class_id", classId),
    ]);

  if (!cls) notFound();
  const showClass = cls as ShowClass;
  const showRow = show as Pick<Show, "name" | "start_date" | "end_date"> | null;
  const pattern = patternRow as ClassPatternRow | null;
  const libraryPattern = getNrhaPattern(pattern?.pattern_key ?? null);

  const judgeNames =
    (classJudges ?? [])
      .map((cj) => (cj.show_staff as unknown as { display_name: string } | null)?.display_name)
      .filter(Boolean)
      .join(", ") || "";

  const entries = drawRows.filter((r) => r.entryClassStatus !== "scratched");
  const pages = chunk(entries, ROWS_PER_PAGE);

  return (
    <div>
      <div className="no-print mb-4 flex items-center justify-between">
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Printable scribe copy — official NRHA score-sheet layout, blank
          maneuver/penalty/score cells for hand recording.
        </p>
        <PrintButton />
      </div>

      {pages.map((pageRows, pageIndex) => (
        <section key={pageIndex} className="score-sheet-page">
          <h1 className="text-center text-lg font-bold uppercase tracking-wide">
            NRHA Judges Score Sheet
          </h1>

          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <FieldLine label="Judge" value={judgeNames} />
            <FieldLine label="Pattern" value={libraryPattern?.label ?? ""} />
            <FieldLine label="Event" value={showRow?.name ?? ""} />
            <FieldLine
              label="Date"
              value={showClass.scheduled_date ?? showRow?.start_date ?? ""}
            />
            <FieldLine
              label="Class"
              value={`${showClass.class_number} — ${showClass.name}`}
            />
          </div>

          <p className="mt-3 text-xs font-semibold">
            MANEUVER SCORES: -1&frac12; Extremely Poor &nbsp; -1 Very Poor
            &nbsp; -&frac12; Poor &nbsp; 0 Correct &nbsp; +&frac12; Good
            &nbsp; +1 Very Good &nbsp; +1&frac12; Excellent
          </p>

          {libraryPattern && (
            <div className="mt-2 text-xs leading-snug">
              <p className="font-semibold">Maneuver key — {libraryPattern.label}</p>
              <ol className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 pl-4 list-decimal">
                {libraryPattern.maneuvers.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ol>
            </div>
          )}

          <table className="score-sheet-table mt-3 w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="score-cell w-14">Draw</th>
                <th className="score-cell w-14">Exh#</th>
                <th className="score-cell w-16">&nbsp;</th>
                {Array.from({ length: 8 }, (_, i) => (
                  <th key={i} className="score-cell w-10">
                    {i + 1}
                  </th>
                ))}
                <th className="score-cell w-14">Total</th>
                <th className="score-cell w-16">Score</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <Fragment key={row.id}>
                  <tr>
                    <td rowSpan={2} className="score-cell font-mono">
                      {row.position}
                    </td>
                    <td rowSpan={2} className="score-cell font-mono font-semibold">
                      {row.backNumber ? `#${row.backNumber}` : ""}
                    </td>
                    <td className="score-cell text-[10px]">Penalty</td>
                    {Array.from({ length: 8 }, (_, i) => (
                      <td key={i} className="score-cell" />
                    ))}
                    <td rowSpan={2} className="score-cell" />
                    <td rowSpan={2} className="score-cell" />
                  </tr>
                  <tr>
                    <td className="score-cell text-[10px]">Score</td>
                    {Array.from({ length: 8 }, (_, i) => (
                      <td key={i} className="score-cell" />
                    ))}
                  </tr>
                </Fragment>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={12} className="score-cell text-center text-stone-400">
                    No entries in the draw yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <p className="mt-6 text-sm">
            Judge&apos;s Signature: ____________________________________________
          </p>
        </section>
      ))}
    </div>
  );
}

function FieldLine({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="font-semibold">{label}:</span>{" "}
      <span className="border-b border-stone-400">
        {value || " ".repeat(20)}
      </span>
    </p>
  );
}
