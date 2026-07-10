import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { CreateClassForm } from "@/components/show/class-form";
import { getClassCodeOptions } from "@/lib/rule-package-options";
import { Alert, PageHeader } from "@/components/ui";

export const metadata = { title: "Add class — ShowRing IQ" };

export default async function NewClassPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: show } = await supabase
    .from("shows")
    .select("id, organization_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!show) notFound();

  const [canCreate, { data: maxRow }, classCodeOptions] = await Promise.all([
    hasOrgPermission(show.organization_id, "class.create"),
    supabase
      .from("classes")
      .select("class_number")
      .eq("show_id", id)
      .order("class_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getClassCodeOptions(supabase, show.organization_id),
  ]);

  const showEditable = show.status === "draft" || show.status === "published";

  return (
    <div>
      <PageHeader
        title="Add class"
        description="Money is tracked to the penny. Entry fee and added money can be adjusted until the show locks."
      />
      {canCreate && showEditable ? (
        <CreateClassForm
          showId={id}
          nextClassNumber={(maxRow?.class_number ?? 0) + 1}
          classCodeOptions={classCodeOptions}
        />
      ) : (
        <Alert tone="info">
          {showEditable
            ? "You don't have the class.create permission in this organization."
            : `This show is ${show.status}; classes can't be added.`}
        </Alert>
      )}
    </div>
  );
}
