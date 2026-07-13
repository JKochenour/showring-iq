import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { AnnouncementForm } from "@/components/show/announcement-form";
import { Alert, Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Announcements — ShowRing IQ" };

export default async function AnnouncementsPage({
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

  const canSend = await hasOrgPermission(show.organization_id, "show.edit");
  if (!canSend) {
    return <Alert>You don&apos;t have permission to send announcements for this show.</Alert>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        description="Broadcast a message to everyone entered in this show — arena changes, weather delays, schedule moves."
      />
      <Card>
        <AnnouncementForm showId={id} />
      </Card>
    </div>
  );
}
