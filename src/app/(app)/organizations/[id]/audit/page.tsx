import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/permissions";
import { Alert, Card, EmptyState } from "@/components/ui";
import type { AuditLogRow } from "@/lib/types";

export const metadata = { title: "Audit log — ShowRing IQ" };

export default async function AuditLogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!org) notFound();

  const canView = await hasOrgPermission(id, PERMISSIONS.AUDIT_VIEW);
  if (!canView) {
    return (
      <Alert tone="info">
        You don&apos;t have permission to view the audit log.
      </Alert>
    );
  }

  const { data: logs } = await supabase
    .from("audit_logs")
    .select(
      "id, actor_role, action_type, entity_type, entity_id, old_value, new_value, reason, created_at, actor:profiles!audit_logs_actor_user_id_fkey(email, full_name)"
    )
    .eq("organization_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (logs as unknown as AuditLogRow[]) ?? [];

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No audit entries yet"
        description="Every override, role change, invite, and setting update is recorded here."
      />
    );
  }

  return (
    <Card>
      <h2 className="mb-4 text-base font-semibold">
        Audit log (latest {rows.length})
      </h2>
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {rows.map((log) => (
          <li key={log.id} className="py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm">
                <span className="font-medium">
                  {log.actor?.full_name || log.actor?.email || "System"}
                </span>{" "}
                <span className="text-zinc-500 dark:text-zinc-400">
                  ({log.actor_role ?? "—"})
                </span>{" "}
                — <span className="font-mono text-xs">{log.action_type}</span>
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {new Date(log.created_at).toLocaleString()}
              </p>
            </div>
            {(log.old_value || log.new_value) && (
              <p className="mt-1 break-all font-mono text-xs text-zinc-500 dark:text-zinc-400">
                {log.old_value && `from ${JSON.stringify(log.old_value)} `}
                {log.new_value && `to ${JSON.stringify(log.new_value)}`}
              </p>
            )}
            {log.reason && (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Reason: {log.reason}
              </p>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
