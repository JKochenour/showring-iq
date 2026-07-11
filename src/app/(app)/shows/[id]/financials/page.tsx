import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { loadShowBillingRoster } from "@/lib/billing";
import { BillingRoster } from "@/components/show/billing-roster";
import { Alert, PageHeader } from "@/components/ui";
import type { Show } from "@/lib/types";

export const metadata = { title: "Financials — ShowRing IQ" };

export default async function FinancialsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: show } = await supabase
    .from("shows")
    .select("id, organization_id")
    .eq("id", id)
    .maybeSingle();
  if (!show) notFound();
  const s = show as Pick<Show, "id" | "organization_id">;

  const canView = await hasOrgPermission(s.organization_id, "invoice.view");
  if (!canView) {
    return (
      <Alert>You don&apos;t have permission to view financials for this show.</Alert>
    );
  }

  const rows = await loadShowBillingRoster(supabase, id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financials"
        description="Every entered rider/owner and what they owe — entry fees plus any misc charges added to their bill."
      />
      <BillingRoster showId={id} rows={rows} />
    </div>
  );
}
