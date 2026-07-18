import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { loadClassDraw } from "@/lib/load-draw";
import { getNrhaPattern } from "@/lib/nrha-patterns";
import { PrintButton } from "@/components/show/print-button";
import {
  formatClassCode,
  loadSlateNumber,
  resolveNrhaCode,
  type ClassCodeAffiliation,
} from "@/lib/class-code";
import type { ClassPatternRow, Show, ShowClass } from "@/lib/types";

export const metadata = { title: "Scribe score sheet — ShowRing IQ" };

/** The paper form holds ten runs per page. */
const BLOCKS_PER_PAGE = 10;
const MANEUVERS = 8;

function chunk<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [[]];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}

/** Shared column geometry so the header band lines up with every run
 * block below it — they are separate tables, as on the paper form. */
function ScoreCols() {
  return (
    <colgroup>
      <col className="col-draw" />
      <col className="col-exh" />
      <col className="col-label" />
      {Array.from({ length: MANEUVERS }, (_, i) => (
        <col key={i} className="col-man" />
      ))}
      <col className="col-total" />
      <col className="col-score" />
    </colgroup>
  );
}

/** The elbow arrow printed in the TOTAL column: the maneuver total
 * carries down into the score box. */
function TotalArrow() {
  return (
    <svg viewBox="0 0 40 34" className="score-arrow" aria-hidden="true">
      <path
        d="M2 6 H26 V24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M26 32 l-4 -8 h8 z" fill="currentColor" />
    </svg>
  );
}

function RunBlock({
  draw,
  exhibitor,
}: {
  draw?: number | null;
  exhibitor?: string | null;
}) {
  return (
    <table className="score-block">
      <ScoreCols />
      <tbody>
        <tr>
          <td className="sc sc-lbl">DRAW</td>
          <td className="sc sc-lbl">EXH#</td>
          <td className="sc sc-lbl">PENALTY</td>
          {Array.from({ length: MANEUVERS }, (_, i) => (
            <td key={i} className="sc sc-pen" />
          ))}
          <td rowSpan={2} className="sc sc-total">
            <TotalArrow />
          </td>
          <td className="sc sc-lbl">SCORE</td>
        </tr>
        <tr>
          <td className="sc sc-val">{draw ?? ""}</td>
          <td className="sc sc-val">{exhibitor ?? ""}</td>
          <td className="sc sc-lbl">SCORE</td>
          {Array.from({ length: MANEUVERS }, (_, i) => (
            <td key={i} className="sc" />
          ))}
          <td className="sc" />
        </tr>
      </tbody>
    </table>
  );
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
      supabase
        .from("classes")
        .select(
          `*, affiliations:class_affiliations(code:association_class_codes(code, name, rule_package:association_rule_packages(association:associations(name))))`
        )
        .eq("id", classId)
        .eq("show_id", id)
        .maybeSingle(),
      supabase
        .from("shows")
        .select("id, name, start_date, end_date, weekend_id")
        .eq("id", id)
        .maybeSingle(),
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
  const showRow = show as
    | Pick<Show, "id" | "name" | "start_date" | "end_date" | "weekend_id">
    | null;
  const slateNumber = showRow
    ? await loadSlateNumber(supabase, showRow)
    : 1;
  const pattern = patternRow as ClassPatternRow | null;
  const libraryPattern = getNrhaPattern(pattern?.pattern_key ?? null);

  const judgeNames =
    (classJudges ?? [])
      .map((cj) => (cj.show_staff as unknown as { display_name: string } | null)?.display_name)
      .filter(Boolean)
      .join(", ") || "";

  // The judge scores an NRHA class, not our local class number — the sheet
  // travels with the results, so it carries the code NRHA will file it
  // under, and the "(2)" that marks the weekend's second go.
  const resolvedCode = resolveNrhaCode(
    cls as unknown as {
      nrha_class_code?: string | null;
      affiliations?: ClassCodeAffiliation[] | null;
    }
  );
  const classLabel = resolvedCode
    ? `${formatClassCode(resolvedCode.code, slateNumber)} ${resolvedCode.name ?? showClass.name}`
    : `${showClass.class_number} — ${showClass.name}`;

  const entries = drawRows.filter((r) => r.entryClassStatus !== "scratched");
  const pages = chunk(entries, BLOCKS_PER_PAGE);

  return (
    <div>
      <div className="no-print mb-4 flex items-center justify-between">
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Printable scribe copy — the official NRHA judges score sheet, with
          the draw and back numbers filled in.
        </p>
        <PrintButton />
      </div>

      {pages.map((pageRows, pageIndex) => (
        <section key={pageIndex} className="score-sheet-page">
          <div className="score-title-row">
            <h1 className="score-title">NRHA JUDGES SCORE SHEET</h1>
            <p className="score-field score-field-judge">
              Judge <span className="score-rule">{judgeNames}</span>
            </p>
          </div>

          <p className="score-field score-field-line">
            <span className="score-field-part">
              Event <span className="score-rule">{showRow?.name ?? ""}</span>
            </span>
            <span className="score-field-part">
              Date{" "}
              <span className="score-rule">
                {showClass.scheduled_date ?? showRow?.start_date ?? ""}
              </span>
            </span>
            <span className="score-field-part">
              Class <span className="score-rule">{classLabel}</span>
            </span>
            <span className="score-field-part">
              Pattern{" "}
              <span className="score-rule">{libraryPattern?.label ?? ""}</span>
            </span>
          </p>

          <p className="score-legend">
            MANEUVER SCORES: &nbsp;-1 1/2 Extremely Poor &nbsp; -1 Very Poor
            &nbsp; -1/2 Poor &nbsp; 0 Correct &nbsp; +1/2 Good &nbsp; +1 Very
            Good &nbsp; +1 1/2 Excellent
          </p>

          {/* Column band above the run blocks, borderless like the form. */}
          <table className="score-band">
            <ScoreCols />
            <tbody>
              <tr>
                <td />
                <td />
                <td className="band-desc">
                  MANEUVER
                  <br />
                  DESCRIPTION
                </td>
                {Array.from({ length: MANEUVERS }, (_, i) => (
                  <td key={i} className="band-slash">
                    /
                  </td>
                ))}
                <td />
                <td className="band-penalty">PENALTY</td>
              </tr>
              <tr>
                <td />
                <td />
                <td className="band-desc">MANEUVER</td>
                {Array.from({ length: MANEUVERS }, (_, i) => (
                  <td key={i} className="band-num">
                    {i + 1}
                  </td>
                ))}
                <td className="band-num">TOTAL</td>
                <td />
              </tr>
            </tbody>
          </table>

          {Array.from({ length: BLOCKS_PER_PAGE }, (_, i) => {
            const row = pageRows[i];
            return (
              // The form leaves a wider gap at the halfway mark.
              <div
                key={row?.id ?? `blank-${i}`}
                className={i === 4 ? "score-block-wrap score-block-gap" : "score-block-wrap"}
              >
                <RunBlock
                  draw={row?.position ?? null}
                  exhibitor={row?.backNumber ? `${row.backNumber}` : null}
                />
              </div>
            );
          })}

          <p className="score-signature">
            Judge&apos;s Signature<span className="score-rule score-rule-long" />
          </p>
        </section>
      ))}
    </div>
  );
}
