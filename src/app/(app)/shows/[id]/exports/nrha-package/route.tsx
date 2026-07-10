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
 * + verified collected paperwork + a submission summary. Not included:
 * an audit log excerpt (log_audit doesn't tag entries with show_id, so a
 * reliable per-show filter isn't available without a schema change) —
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

  const { data: entryRows } = await supabase
    .from("entries")
    .select("rider_person_id, horse_id")
    .eq("show_id", id);
  const riderIds = [...new Set((entryRows ?? []).map((e) => e.rider_person_id))];
  const horseIds = [...new Set((entryRows ?? []).map((e) => e.horse_id))];

  const [{ data: riderDocs }, { data: horseDocs }, { data: showDocs }, { data: riders }, { data: horses }] =
    await Promise.all([
      riderIds.length > 0
        ? supabase.from("documents").select("*").eq("status", "verified").in("person_id", riderIds)
        : Promise.resolve({ data: [] as never[] }),
      horseIds.length > 0
        ? supabase.from("documents").select("*").eq("status", "verified").in("horse_id", horseIds)
        : Promise.resolve({ data: [] as never[] }),
      supabase.from("documents").select("*").eq("status", "verified").eq("show_id", id),
      riderIds.length > 0
        ? supabase.from("people").select("id, first_name, last_name").in("id", riderIds)
        : Promise.resolve({ data: [] as never[] }),
      horseIds.length > 0
        ? supabase.from("horses").select("id, registered_name").in("id", horseIds)
        : Promise.resolve({ data: [] as never[] }),
    ]);

  const riderNameById = new Map((riders ?? []).map((r) => [r.id, `${r.first_name}_${r.last_name}`]));
  const horseNameById = new Map((horses ?? []).map((h) => [h.id, h.registered_name]));

  type Doc = {
    id: string;
    file_path: string;
    file_name: string;
    document_type: string;
    person_id: string | null;
    horse_id: string | null;
  };
  const allDocs = [
    ...((riderDocs ?? []) as Doc[]),
    ...((horseDocs ?? []) as Doc[]),
    ...((showDocs ?? []) as Doc[]),
  ];
  const uniqueDocs = [...new Map(allDocs.map((d) => [d.id, d])).values()];

  const zip = new JSZip();

  let paperworkCount = 0;
  for (const doc of uniqueDocs) {
    const { data: blob } = await supabase.storage.from("documents").download(doc.file_path);
    if (!blob) continue;
    const label = doc.person_id
      ? (riderNameById.get(doc.person_id) ?? "rider")
      : doc.horse_id
        ? (horseNameById.get(doc.horse_id) ?? "horse")
        : "show";
    const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, "_");
    const buffer = new Uint8Array(await blob.arrayBuffer());
    zip.file(`paperwork/${safeLabel}_${doc.document_type}_${doc.file_name}`, buffer);
    paperworkCount++;
  }

  const summaryLines = [
    `${show.name} — NRHA Submission Summary`,
    `Generated: ${new Date().toISOString()}`,
    `Classes included: ${nrhaData.includedClassCount}`,
    `CSV rows: ${nrhaData.rows.length}`,
    `Collected paperwork included: ${paperworkCount} verified document(s)`,
    "",
    "Readiness checks:",
    ...(nrhaData.readiness.length === 0
      ? ["  All checks passed."]
      : nrhaData.readiness.map((i) => `  [${i.severity}] ${i.message}`)),
    "",
    "Not included in this package: an audit log excerpt (requires a schema",
    "change to tag audit entries with show_id for reliable filtering).",
  ];

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
