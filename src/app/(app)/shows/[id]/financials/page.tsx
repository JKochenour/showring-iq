import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { loadShowBillingRoster } from "@/lib/billing";
import { BillingRoster } from "@/components/show/billing-roster";
import { CloseOutCard } from "@/components/show/close-out-card";
import { StandardChargesBackfillCard } from "@/components/show/standard-charges-backfill-card";
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
      "id, organization_id, end_date, timezone, payouts_distributed_at, close_out_fee_cents, close_out_deadline, weekend_id, standard_entry_charges"
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
    | "weekend_id"
  > & {
    standard_entry_charges: {
      label: string;
      amount_cents: number;
      per_run?: boolean;
    }[] | null;
  };

  // Only the once-per-horse-per-weekend charges can be backfilled; per-run
  // judge/video/photo fees are computed live in billing.ts and never
  // materialized, so they self-correct and need no apply step.
  const standardCharges = (s.standard_entry_charges ?? [])
    .filter((c) => c.per_run !== true && c.label && c.amount_cents > 0)
    .map((c) => ({ label: c.label, amountCents: c.amount_cents }));

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

  // A slate's financials only ever show that slate. When the show is one
  // of several slates in a weekend, an exhibitor's real total lives on the
  // consolidated bill — and once-per-weekend charges (office/stall/drug)
  // sit on whichever slate first signed the horse up, so a sibling slate
  // legitimately shows nothing. Point staff at the weekend bill rather
  // than letting them conclude the entry is missing.
  let weekend: { id: string; name: string; slateCount: number } | null = null;
  if (s.weekend_id) {
    const [{ data: slates }, { data: weekendRow }] = await Promise.all([
      supabase.from("shows").select("id").eq("weekend_id", s.weekend_id),
      supabase
        .from("show_weekends")
        .select("id, name")
        .eq("id", s.weekend_id)
        .maybeSingle(),
    ]);
    const slateCount = slates?.length ?? 0;
    if (slateCount > 1 && weekendRow) {
      weekend = {
        id: weekendRow.id as string,
        name: weekendRow.name as string,
        slateCount,
      };
    }
  }

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
      {weekend && (
        <Alert tone="info">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>
              This is one slate of{" "}
              <span className="font-semibold">{weekend.name}</span> (
              {weekend.slateCount} slates). These totals cover this slate
              only — office, stall, and drug fees are charged once per horse
              for the whole circuit, so they appear on whichever slate the
              horse was signed up on first.
            </p>
            <ButtonLink
              href={`/organizations/${s.organization_id}/weekends/${weekend.id}/financials`}
              variant="secondary"
            >
              Consolidated circuit bill
            </ButtonLink>
          </div>
        </Alert>
      )}
      <PayoutDeadlineCard
        showId={id}
        {...payoutDeadlineInfo(s.end_date)}
        distributedAt={s.payouts_distributed_at}
        totalMoneyWonCents={totalMoneyWonCents}
        canMark={canApprovePayouts}
      />
      {standardCharges.length > 0 && (
        <StandardChargesBackfillCard
          showId={id}
          charges={standardCharges}
          canApply={canEditInvoices}
        />
      )}
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
