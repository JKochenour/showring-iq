import { NextResponse, type NextRequest } from "next/server";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { loadNrhaExportData } from "@/lib/load-nrha-export";

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

  const data = await loadNrhaExportData(supabase, id);
  if (!data.ready) {
    return NextResponse.json(
      {
        error:
          "Export blocked: unresolved blocking issues. Review the Exports tab.",
        issues: data.readiness,
      },
      { status: 422 }
    );
  }

  await supabase.rpc("log_audit", {
    p_org: show.organization_id,
    p_action: "export.nrha_csv_generated",
    p_entity_type: "show",
    p_entity_id: id,
    p_old: null,
    p_new: {
      classes: data.includedClassCount,
      rows: data.rows.length,
    },
    p_show: id,
  });

  const filename = `${show.slug || "show"}-nrha-reinersuite.csv`;

  return new NextResponse(data.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
