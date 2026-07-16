import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { getSiteOrigin } from "@/lib/site-url";
import { centsToInput } from "@/lib/money";
import { ShowSettingsForm } from "@/components/show/show-settings-form";
import { ShowStatusActions } from "@/components/show/show-status-actions";
import { PublicLinkCard } from "@/components/show/public-link-card";
import { StandardChargesEditor } from "@/components/show/standard-charges-editor";
import { ConditionalFeesForm } from "@/components/show/conditional-fees-form";
import { ScheduleSettingsForm } from "@/components/show/schedule-settings-form";
import { Alert, Card } from "@/components/ui";
import type { Show } from "@/lib/types";

export const metadata = { title: "Show settings — ShowRing IQ" };

export default async function ShowSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: show } = await supabase
    .from("shows")
    .select("*, organization:organizations(slug)")
    .eq("id", id)
    .maybeSingle();
  if (!show) notFound();
  const s = show as Show;
  const orgSlug = (show.organization as unknown as { slug: string } | null)?.slug;
  const publicUrl = orgSlug
    ? `${await getSiteOrigin()}/${orgSlug}/${s.slug}`
    : null;
  const qrSvg = publicUrl
    ? await QRCode.toString(publicUrl, { type: "svg", margin: 1, width: 176 })
    : null;

  const [canEdit, canPublish, canLock, canArchive, canDelete] =
    await Promise.all([
      hasOrgPermission(s.organization_id, "show.edit"),
      hasOrgPermission(s.organization_id, "show.publish"),
      hasOrgPermission(s.organization_id, "show.lock"),
      hasOrgPermission(s.organization_id, "show.archive"),
      hasOrgPermission(s.organization_id, "show.delete"),
    ]);

  const editable = canEdit && (s.status === "draft" || s.status === "published");

  return (
    <div className="space-y-6">
      <ShowStatusActions
        showId={s.id}
        organizationId={s.organization_id}
        status={s.status}
        canPublish={canPublish}
        canLock={canLock}
        canArchive={canArchive}
        canDelete={canDelete}
      />

      <section>
        <h2 className="mb-3 text-base font-semibold">Public page</h2>
        {publicUrl && qrSvg ? (
          <Card>
            <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">
              Anyone with this link can see the schedule, current class, draw
              order, live scores, and posted results — no account needed.
              {s.status !== "published" &&
                " The show is not published yet, so the link won't resolve until it is."}
            </p>
            <PublicLinkCard url={publicUrl} qrSvg={qrSvg} />
          </Card>
        ) : (
          <Alert tone="info">
            Couldn&apos;t determine this organization&apos;s URL slug.
          </Alert>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">Show details</h2>
        {editable ? (
          <ShowSettingsForm show={s} />
        ) : (
          <Alert tone="info">
            {canEdit
              ? `This show is ${s.status} and can't be edited. ${
                  s.status === "locked"
                    ? "Unlock it above to make changes."
                    : "Restore it above to make changes."
                }`
              : "You don't have permission to edit this show."}
          </Alert>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">
          Standard per-entry charges
        </h2>
        <Card>
          <StandardChargesEditor
            showId={s.id}
            charges={(s.standard_entry_charges ?? []).map((c) => ({
              label: c.label,
              amount: centsToInput(c.amount_cents),
              perRun: c.per_run ?? false,
              youthExempt: c.youth_exempt ?? false,
            }))}
            canEdit={editable}
          />
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">
          Late entry, close-out, and card fees
        </h2>
        <Card>
          <ConditionalFeesForm
            showId={s.id}
            lateEntryFee={centsToInput(s.late_entry_fee_cents ?? 0)}
            closeOutFee={centsToInput(s.close_out_fee_cents ?? 0)}
            closeOutDeadline={s.close_out_deadline ? s.close_out_deadline.slice(0, 16) : ""}
            cardSurchargePercent={s.card_surcharge_percent ?? 0}
            canEdit={editable}
          />
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">Schedule settings</h2>
        <Card>
          <ScheduleSettingsForm
            showId={s.id}
            startTime={(s.schedule_start_time ?? "08:00:00").slice(0, 5)}
            breakMinutes={s.schedule_break_minutes ?? 10}
            dragMinutes={s.schedule_drag_minutes ?? 5}
            canEdit={editable}
          />
        </Card>
      </section>
    </div>
  );
}
