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
          {/* Title left, judge right — the official sheet's first line. */}
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="text-sm font-bold uppercase tracking-wide">
              NRHA Judges Score Sheet
            </h1>
            <p className="flex-1 text-sm">
              Judge <FieldRule value={judgeNames} />
            </p>
          </div>

          {/* Event / Date / Class / Pattern on one line, as printed. */}
          <p className="mt-2 flex flex-wrap items-baseline gap-x-3 text-sm">
            <span className="flex-1 whitespace-nowrap">
              Event <FieldRule value={showRow?.name ?? ""} />
            </span>
            <span className="whitespace-nowrap">
              Date{" "}
              <FieldRule
                value={showClass.scheduled_date ?? showRow?.start_date ?? ""}
              />
            </span>
            <span className="flex-1 whitespace-nowrap">
              Class{" "}
              <FieldRule
                value={`${showClass.class_number} — ${showClass.name}`}
              />
            </span>
            <span className="whitespace-nowrap">
              Pattern <FieldRule value={libraryPattern?.label ?? ""} />
            </span>
          </p>

          <p className="mt-2 text-[10px] font-semibold">
            MANEUVER SCORES: -1&frac12; Extremely Poor &nbsp; -1 Very Poor
            &nbsp; -&frac12; Poor &nbsp; 0 Correct &nbsp; +&frac12; Good
            &nbsp; +1 Very Good &nbsp; +1&frac12; Excellent
          </p>

          <table className="score-sheet-table mt-2 w-full border-collapse text-[10px]">
            <thead>
              <tr>
                <th className="score-cell score-head w-10">Draw</th>
                <th className="score-cell score-head w-12">Exh#</th>
                <th className="score-cell score-head w-20">
                  Maneuver
                  <br />
                  Description
                </th>
                {Array.from({ length: 8 }, (_, i) => (
                  <th key={i} className="score-cell score-head">
                    {i + 1}
                  </th>
                ))}
                <th className="score-cell score-head w-12">Total</th>
                <th className="score-cell score-head w-12">Penalty</th>
                <th className="score-cell score-head w-14">Score</th>
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
                    <td className="score-cell score-rowlabel">Penalty</td>
                    {Array.from({ length: 8 }, (_, i) => (
                      <td key={i} className="score-cell" />
                    ))}
                    <td rowSpan={2} className="score-cell" />
                    <td rowSpan={2} className="score-cell" />
                    <td rowSpan={2} className="score-cell" />
                  </tr>
                  <tr>
                    <td className="score-cell score-rowlabel">Score</td>
                    {Array.from({ length: 8 }, (_, i) => (
                      <td key={i} className="score-cell" />
                    ))}
                  </tr>
                </Fragment>
              ))}
              {/* The printed sheet always has ten blank run blocks, so late
                  entries and re-rides can be written in by hand. */}
              {Array.from(
                { length: Math.max(0, ROWS_PER_PAGE - pageRows.length) },
                (_, i) => (
                  <Fragment key={`blank-${i}`}>
                    <tr>
                      <td rowSpan={2} className="score-cell" />
                      <td rowSpan={2} className="score-cell" />
                      <td className="score-cell score-rowlabel">Penalty</td>
                      {Array.from({ length: 8 }, (_, c) => (
                        <td key={c} className="score-cell" />
                      ))}
                      <td rowSpan={2} className="score-cell" />
                      <td rowSpan={2} className="score-cell" />
                      <td rowSpan={2} className="score-cell" />
                    </tr>
                    <tr>
                      <td className="score-cell score-rowlabel">Score</td>
                      {Array.from({ length: 8 }, (_, c) => (
                        <td key={c} className="score-cell" />
                      ))}
                    </tr>
                  </Fragment>
                )
              )}
            </tbody>
          </table>

          <p className="mt-4 text-sm">
            Judge&apos;s Signature
            <span className="ml-2 inline-block w-[70%] border-b border-black align-bottom" />
          </p>
        </section>
      ))}
    </div>
  );
}

/** A value sitting on a printed rule, the way the paper sheet has a blank
 * line after each label. An empty value still draws the rule so the sheet
 * can be completed by hand. */
function FieldRule({ value }: { value: string }) {
  return (
    <span className="ml-1 inline-block min-w-24 border-b border-black px-1">
      {value || " "}
    </span>
  );
}

