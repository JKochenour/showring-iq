import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/permissions";
import { OrgSettingsForm } from "@/components/org/org-settings-form";
import { Alert, Card } from "@/components/ui";
import type { Organization, OrganizationRole } from "@/lib/types";

export const metadata = { title: "Settings — ShowRing IQ" };

export default async function OrgSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const [{ data: org }, { data: roles }, { data: rolePerms }, canEdit] =
    await Promise.all([
      supabase.from("organizations").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("organization_roles")
        .select("id, key, name, description, is_system, organization_id")
        .eq("organization_id", id)
        .order("name"),
      supabase
        .from("organization_role_permissions")
        .select("role_id, permission_key"),
      hasOrgPermission(id, PERMISSIONS.ORG_EDIT),
    ]);

  if (!org) notFound();

  const permCounts = new Map<string, number>();
  for (const rp of rolePerms ?? []) {
    permCounts.set(rp.role_id, (permCounts.get(rp.role_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-base font-semibold">Organization profile</h2>
        {canEdit ? (
          <OrgSettingsForm organization={org as Organization} />
        ) : (
          <Alert tone="info">
            You don&apos;t have permission to edit this organization&apos;s
            settings. Ask an Organization Owner.
          </Alert>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">Roles</h2>
        <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
          Roles are presets of granular permissions. Business logic always
          checks permissions, never role names. Custom role editing arrives in
          a later sprint.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {((roles as OrganizationRole[]) ?? []).map((role) => (
            <Card key={role.id}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{role.name}</h3>
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  {permCounts.get(role.id) ?? 0} permissions
                </span>
              </div>
              {role.description && (
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {role.description}
                </p>
              )}
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
