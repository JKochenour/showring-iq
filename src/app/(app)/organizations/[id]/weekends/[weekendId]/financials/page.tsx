import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { loadWeekendBillingRoster } from "@/lib/billing";
import { BillingRoster } from "@/components/show/billing-roster";
import { Alert, PageHeader } from "@/components/ui";

export const metadata = { title: "Weekend billing — ShowRing IQ" };

export default async function WeekendFinancialsPage({
  params,
}: {
  params: Promise<{ id: string; weekendId: string }>;
}) {
  const { id, weekendId } = await params;
  const { supabase } = await requireUser();

  const { data: weekend } = await supabase
    .from("show_weekends")
    .select("id, name, organization_id")
    .eq("id", weekendId)
    .maybeSingle();
  if (!weekend || weekend.organization_id !== id) notFound();

  const canView = await hasOrgPermission(id, "invoice.view");
  if (!canView) {
    return (
      <Alert>You don&apos;t have permission to view financials for this weekend.</Alert>
    );
  }

  const rows = await loadWeekendBillingRoster(supabase, weekendId);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          <Link
            href={`/organizations/${id}/weekends/${weekendId}`}
            className="hover:underline"
          >
            {weekend.name}
          </Link>{" "}
          / Consolidated billing
        </p>
        <PageHeader
          title="Consolidated billing"
          description="One row per responsible party across every slate — office/stall/drug counted once, class/video/photo per run."
        />
      </div>
      <BillingRoster
        showId={weekendId}
        rows={rows}
        linkBase={`/organizations/${id}/weekends/${weekendId}/financials`}
      />
    </div>
  );
}
