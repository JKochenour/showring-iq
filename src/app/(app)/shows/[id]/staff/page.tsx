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

  const [{ data: staff }, { data: members }, canEdit] = await Promise.all([
    supabase
      .from("show_staff")
      .select(
        "id, show_id, user_id, display_name, staff_role, notes, created_at, profile:profiles(email, full_name)"
      )
      .eq("show_id", id)
      .order("created_at"),
    supabase
      .from("organization_members")
      .select("user_id, profile:profiles(email, full_name)")
      .eq("organization_id", s.organization_id)
      .eq("status", "active"),
    hasOrgPermission(s.organization_id, "show.edit"),
  ]);

  const staffRows = (staff as unknown as ShowStaffRow[]) ?? [];
  const memberOptions =
    members?.map((m) => {
      const profile = m.profile as unknown as {
        email: string;
        full_name: string | null;
      } | null;
      return {
        userId: m.user_id as string,
        label: profile?.full_name
          ? `${profile.full_name} (${profile.email})`
          : (profile?.email ?? "Unknown"),
      };
    }) ?? [];

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
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Role</th>
                  <th className="py-2 pr-4 font-medium">Notes</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {staffRows.map((member) => (
                  <tr key={member.id}>
                    <td className="py-3 pr-4">
                      <p className="font-medium">{member.display_name}</p>
                      {member.profile && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {member.profile.email}
                        </p>
                      )}
                      {!member.user_id && (
                        <p className="text-xs text-zinc-400">
                          Not a platform user
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-4">{roleLabel(member.staff_role)}</td>
                    <td className="py-3 pr-4 text-zinc-500 dark:text-zinc-400">
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
