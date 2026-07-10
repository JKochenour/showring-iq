import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { ShowSettingsForm } from "@/components/show/show-settings-form";
import { ShowStatusActions } from "@/components/show/show-status-actions";
import { Alert } from "@/components/ui";
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
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!show) notFound();
  const s = show as Show;

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
    </div>
  );
}
