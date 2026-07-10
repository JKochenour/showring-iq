import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse, type NextRequest } from "next/server";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { loadShowResults } from "@/lib/load-show-results";
import { ResultsDocument } from "@/lib/pdf/results-document";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: show } = await supabase
    .from("shows")
    .select("id, organization_id, slug")
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

  const data = await loadShowResults(supabase, id);
  if (data.classes.length === 0) {
    return NextResponse.json(
      { error: "No official classes yet — nothing to generate." },
      { status: 422 }
    );
  }

  const buffer = await renderToBuffer(<ResultsDocument data={data} />);

  await supabase.rpc("log_audit", {
    p_org: show.organization_id,
    p_action: "export.results_pdf_generated",
    p_entity_type: "show",
    p_entity_id: id,
    p_old: null,
    p_new: { classes: data.classes.length },
  });

  const filename = `${show.slug || "show"}-results.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
