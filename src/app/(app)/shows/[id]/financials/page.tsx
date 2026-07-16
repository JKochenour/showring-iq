import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { loadShowBillingRoster } from "@/lib/billing";
import { BillingRoster } from "@/components/show/billing-roster";
import { CloseOutCard } from "@/components/show/close-out-card";
import { PayoutDeadlineCard } from "@/components/show/payout-deadline-card";
import { closeOutDeadlineInfo, payoutDeadlineInfo } from "@/lib/results-timing";
import { Alert, ButtonLink, PageHeader } from "@/components/ui";
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
    .select(
      "id, organization_id, end_date, timezone, payouts_distributed_at, close_out_fee_cents, close_out_deadline"
    )
    .eq("id", id)
    .maybeSingle();
  if (!show) notFound();
  const s = show as Pick<
    Show,
    | "id"
    | "organization_id"
    | "end_date"
    | "timezone"
    | "payouts_distributed_at"
    | "close_out_fee_cents"
    | "close_out_deadline"
  >;

  const canView = await hasOrgPermission(s.organization_id, "invoice.view");
  if (!canView) {
    return (
      <Alert>You don&apos;t have permission to view financials for this show.</Alert>
    );
  }

  const [rows, canApprovePayouts, canEditInvoices, { data: moneyRows }] =
    await Promise.all([
    loadShowBillingRoster(supabase, id),
    hasOrgPermission(s.organization_id, "payout.approve"),
    hasOrgPermission(s.organization_id, "invoice.edit"),
    supabase
      .from("results")
      .select("money_won_cents")
      .eq("show_id", id)
      .gt("money_won_cents", 0),
  ]);
  const totalMoneyWonCents = (moneyRows ?? []).reduce(
    (sum, r) => sum + ((r.money_won_cents as number) ?? 0),
    0
  );

  const closeOutInfo = s.close_out_deadline
    ? closeOutDeadlineInfo(s.close_out_deadline, s.timezone)
    : null;
  const openBalanceCount = rows.filter((r) => r.balanceCents > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Financials"
          description="Every entered rider/owner and what they owe — entry fees plus any misc charges added to their bill."
        />
        <ButtonLink href={`/shows/${id}/financials/reconciliation`} variant="secondary">
          Reconciliation report
        </ButtonLink>
      </div>
      <PayoutDeadlineCard
        showId={id}
        {...payoutDeadlineInfo(s.end_date)}
        distributedAt={s.payouts_distributed_at}
        totalMoneyWonCents={totalMoneyWonCents}
        canMark={canApprovePayouts}
      />
      {(s.close_out_fee_cents ?? 0) > 0 && (
        <CloseOutCard
          showId={id}
          feeCents={s.close_out_fee_cents}
          deadlineLabel={closeOutInfo?.deadlineLabel ?? null}
          deadlinePassed={closeOutInfo?.passed ?? false}
          openBalanceCount={openBalanceCount}
          canApply={canEditInvoices}
        />
      )}
      <BillingRoster showId={id} rows={rows} />
    </div>
  );
}
