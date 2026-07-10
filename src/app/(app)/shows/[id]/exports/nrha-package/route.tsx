import { renderToBuffer } from "@react-pdf/renderer";
import JSZip from "jszip";
import { NextResponse, type NextRequest } from "next/server";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { loadNrhaExportData } from "@/lib/load-nrha-export";
import { loadShowResults } from "@/lib/load-show-results";
import { ResultsDocument } from "@/lib/pdf/results-document";
import { ScoreSheetsDocument } from "@/lib/pdf/score-sheets-document";
import { TallyDocument } from "@/lib/pdf/tally-document";

/**
 * v1 submission package: CSV + results PDF + score sheets + tally sheet
 * + a submission summary. Not included yet: collected paperwork (needs a
 * document-management system that doesn't exist), and an audit log
 * excerpt (log_audit doesn't tag entries with show_id, so a reliable
 * per-show filter isn't available without a schema change) — both
 * flagged rather than faked.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: show } = await supabase
    .from("shows")
    .select("id, organization_id, name, slug")
    .eq("id", id)
    .maybeSingle();
  if (!show) {
    return NextResponse.json({ error: "Show not found" }, { status: 404 });
  }

  if (!(await hasOrgPermission(show.organization_id, "result.export"))) {
    return NextResponse.json(
      { error: "Missing permission: result.export" },
      { status: 403 }
    );
  }

  const nrhaData = await loadNrhaExportData(supabase, id);
  if (!nrhaData.ready) {
    return NextResponse.json(
      {
        error: "Export blocked: unresolved blocking issues. Review the Exports tab.",
        issues: nrhaData.readiness,
      },
      { status: 422 }
    );
  }

  const resultsData = await loadShowResults(supabase, id);

  const [resultsPdf, scoreSheetsPdf, tallyPdf] = await Promise.all([
    renderToBuffer(<ResultsDocument data={resultsData} />),
    renderToBuffer(<ScoreSheetsDocument data={resultsData} />),
    renderToBuffer(<TallyDocument data={resultsData} />),
  ]);

  const summaryLines = [
    `${show.name} — NRHA Submission Summary`,
    `Generated: ${new Date().toISOString()}`,
    `Classes included: ${nrhaData.includedClassCount}`,
    `CSV rows: ${nrhaData.rows.length}`,
    "",
    "Readiness checks:",
    ...(nrhaData.readiness.length === 0
      ? ["  All checks passed."]
      : nrhaData.readiness.map((i) => `  [${i.severity}] ${i.message}`)),
    "",
    "Not included in this package: collected paperwork (memberships, licenses,",
    "transfers, non-pro declarations — requires document management, not yet",
    "built) and an audit log excerpt (requires a schema change to tag audit",
    "entries with show_id for reliable filtering).",
  ];

  const zip = new JSZip();
  zip.file("nrha_reinersuite_results.csv", nrhaData.csv);
  zip.file("full_show_results.pdf", resultsPdf);
  zip.file("score_sheets.pdf", scoreSheetsPdf);
  zip.file("tally_and_fees.pdf", tallyPdf);
  zip.file("submission_summary.txt", summaryLines.join("\n"));

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

  await supabase.rpc("log_audit", {
    p_org: show.organization_id,
    p_action: "export.nrha_package_generated",
    p_entity_type: "show",
    p_entity_id: id,
    p_old: null,
    p_new: { classes: nrhaData.includedClassCount, rows: nrhaData.rows.length },
  });

  const filename = `${show.slug || "show"}-nrha-submission.zip`;

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
