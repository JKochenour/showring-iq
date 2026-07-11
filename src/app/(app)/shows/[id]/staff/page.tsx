import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { AddStaffForm, RemoveStaffButton } from "@/components/show/staff-manager";
import { Alert, Card, EmptyState } from "@/components/ui";
import { STAFF_ROLES } from "@/lib/validation/show";
import type { Show, ShowStaffRow } from "@/lib/types";

export const metadata = { title: "Show staff — ShowRing IQ" };

export default async function ShowStaffPage({
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
  const s = show as Pick<Show, "id" | "organization_id" | "status">;

  const [{ data: staffBase }, { data: members }, canEdit] = await Promise.all([
    supabase
      .from("show_staff")
      .select("id, show_id, user_id, display_name, staff_role, notes, created_at")
      .eq("show_id", id)
      .order("created_at"),
    supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", s.organization_id)
      .eq("status", "active"),
    hasOrgPermission(s.organization_id, "show.edit"),
  ]);

  const staffUserIds = [
    ...new Set((staffBase ?? []).map((m) => m.user_id).filter((v): v is string => !!v)),
  ];
  const memberUserIds = [...new Set((members ?? []).map((m) => m.user_id as string))];
  const allProfileIds = [...new Set([...staffUserIds, ...memberUserIds])];
  const { data: profiles } =
    allProfileIds.length > 0
      ? await supabase.from("profiles").select("id, email, full_name").in("id", allProfileIds)
      : { data: [] as { id: string; email: string; full_name: string | null }[] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const staffRows: ShowStaffRow[] = (staffBase ?? []).map((m) => ({
    ...m,
    profile: m.user_id ? (profileById.get(m.user_id) ?? null) : null,
  }));
  const memberOptions = memberUserIds.map((userId) => {
    const profile = profileById.get(userId);
    return {
      userId,
      label: profile?.full_name
        ? `${profile.full_name} (${profile.email})`
        : (profile?.email ?? "Unknown"),
    };
  });

  const roleLabel = (value: string) =>
    STAFF_ROLES.find((r) => r.value === value)?.label ?? value;

  const editable = canEdit && (s.status === "draft" || s.status === "published");

  return (
    <div className="space-y-6">
      {canEdit && !editable && (
        <Alert tone="info">
          This show is {s.status}. Unlock or restore it to change staff.
        </Alert>
      )}
      {editable && <AddStaffForm showId={id} members={memberOptions} />}

      {staffRows.length === 0 ? (
        <EmptyState
          title="No staff assigned"
          description="Assign the show manager, secretary, judges, gate, announcer, and other staff. Link organization members or add outside people by name."
        />
      ) : (
        <Card>
          <h2 className="mb-4 text-base font-semibold">
            Staff ({staffRows.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500 dark:border-stone-800 dark:text-stone-400">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Role</th>
                  <th className="py-2 pr-4 font-medium">Notes</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                {staffRows.map((member) => (
                  <tr key={member.id}>
                    <td className="py-3 pr-4">
                      <p className="font-medium">{member.display_name}</p>
                      {member.profile && (
                        <p className="text-xs text-stone-500 dark:text-stone-400">
                          {member.profile.email}
                        </p>
                      )}
                      {!member.user_id && (
                        <p className="text-xs text-stone-400">
                          Not a platform user
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-4">{roleLabel(member.staff_role)}</td>
                    <td className="py-3 pr-4 text-stone-500 dark:text-stone-400">
                      {member.notes ?? "—"}
                    </td>
                    <td className="py-3 text-right">
                      {editable && (
                        <RemoveStaffButton
                          showId={id}
                          staffId={member.id}
                          label={member.display_name}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
