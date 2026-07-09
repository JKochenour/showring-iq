import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/permissions";
import { InviteMemberForm } from "@/components/org/invite-member-form";
import {
  MemberRoleSelect,
  RemoveMemberButton,
  RevokeInviteButton,
} from "@/components/org/member-actions";
import { Card } from "@/components/ui";
import type { InviteRow, MemberRow, OrganizationRole } from "@/lib/types";

export const metadata = { title: "Members — ShowRing IQ" };

export default async function MembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user } = await requireUser();

  const [
    { data: org },
    { data: members },
    { data: roles },
    { data: invites },
    canInvite,
    canManageRoles,
    canRemove,
  ] = await Promise.all([
    supabase.from("organizations").select("id, name").eq("id", id).maybeSingle(),
    supabase
      .from("organization_members")
      .select(
        "id, user_id, status, created_at, role:organization_roles(id, key, name), profile:profiles(email, full_name)"
      )
      .eq("organization_id", id)
      .order("created_at"),
    supabase
      .from("organization_roles")
      .select("id, key, name, description, is_system, organization_id")
      .eq("organization_id", id)
      .order("name"),
    supabase
      .from("organization_invites")
      .select("id, email, status, created_at, role:organization_roles(id, name)")
      .eq("organization_id", id)
      .eq("status", "pending")
      .order("created_at"),
    hasOrgPermission(id, PERMISSIONS.ORG_MEMBERS_INVITE),
    hasOrgPermission(id, PERMISSIONS.ORG_ROLES_MANAGE),
    hasOrgPermission(id, PERMISSIONS.ORG_MEMBERS_REMOVE),
  ]);

  if (!org) notFound();

  const memberRows = (members as unknown as MemberRow[]) ?? [];
  const roleOptions = ((roles as OrganizationRole[]) ?? []).map((r) => ({
    id: r.id,
    name: r.name,
  }));
  const inviteRows = (invites as unknown as InviteRow[]) ?? [];

  return (
    <div className="space-y-6">
      {canInvite && (
        <InviteMemberForm organizationId={id} roles={roleOptions} />
      )}

      {canInvite && inviteRows.length > 0 && (
        <Card>
          <h2 className="mb-4 text-base font-semibold">
            Pending invites ({inviteRows.length})
          </h2>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {inviteRows.map((invite) => (
              <li
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{invite.email}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Role: {invite.role?.name ?? "—"} · invited{" "}
                    {new Date(invite.created_at).toLocaleDateString()}
                  </p>
                </div>
                <RevokeInviteButton organizationId={id} inviteId={invite.id} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <h2 className="mb-4 text-base font-semibold">
          Members ({memberRows.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="py-2 pr-4 font-medium">Member</th>
                <th className="py-2 pr-4 font-medium">Role</th>
                <th className="py-2 pr-4 font-medium">Joined</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {memberRows.map((member) => {
                const isSelf = member.user_id === user.id;
                const label =
                  member.profile?.full_name || member.profile?.email || "Member";
                return (
                  <tr key={member.id}>
                    <td className="py-3 pr-4">
                      <p className="font-medium">
                        {label}
                        {isSelf && (
                          <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                            you
                          </span>
                        )}
                      </p>
                      {member.profile?.full_name && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {member.profile.email}
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {canManageRoles && member.role ? (
                        <MemberRoleSelect
                          organizationId={id}
                          memberId={member.id}
                          currentRoleId={member.role.id}
                          roles={roleOptions}
                        />
                      ) : (
                        (member.role?.name ?? "—")
                      )}
                    </td>
                    <td className="py-3 pr-4 text-zinc-500 dark:text-zinc-400">
                      {new Date(member.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-right">
                      {(canRemove || isSelf) && (
                        <RemoveMemberButton
                          organizationId={id}
                          memberId={member.id}
                          memberLabel={label}
                          isSelf={isSelf}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
