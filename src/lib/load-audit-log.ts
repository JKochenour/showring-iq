import type { SupabaseClient } from "@supabase/supabase-js";

export interface AuditLogEntry {
  createdAt: string;
  actorEmail: string | null;
  actorRole: string | null;
  actionType: string;
  entityType: string;
  entityId: string | null;
  oldValue: unknown;
  newValue: unknown;
  reason: string | null;
}

/** Loads the show-scoped slice of an organization's audit log, oldest
 * first, for inclusion in the NRHA submission package. Only entries
 * tagged with this show_id are returned — org-level actions (member
 * invites, rule package edits, etc.) never carry a show_id and are
 * correctly excluded, not fabricated. */
export async function loadAuditLogExcerpt(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  organizationId: string,
  showId: string
): Promise<AuditLogEntry[]> {
  const { data: rows } = await supabase
    .from("audit_logs")
    .select("created_at, actor_user_id, actor_role, action_type, entity_type, entity_id, old_value, new_value, reason")
    .eq("organization_id", organizationId)
    .eq("show_id", showId)
    .order("created_at", { ascending: true });

  const actorIds = [...new Set((rows ?? []).map((r) => r.actor_user_id).filter(Boolean))] as string[];
  const { data: profiles } =
    actorIds.length > 0
      ? await supabase.from("profiles").select("id, email").in("id", actorIds)
      : { data: [] as { id: string; email: string }[] };
  const emailById = new Map((profiles ?? []).map((p) => [p.id as string, p.email as string]));

  return (rows ?? []).map((r) => ({
    createdAt: r.created_at as string,
    actorEmail: r.actor_user_id ? (emailById.get(r.actor_user_id as string) ?? r.actor_user_id as string) : null,
    actorRole: r.actor_role as string | null,
    actionType: r.action_type as string,
    entityType: r.entity_type as string,
    entityId: r.entity_id as string | null,
    oldValue: r.old_value,
    newValue: r.new_value,
    reason: r.reason as string | null,
  }));
}

/** Formats an audit log excerpt as a readable plain-text file, one
 * line per entry, chronological — matching the submission_summary.txt
 * plain-text convention used elsewhere in the NRHA package. */
export function formatAuditLogText(entries: AuditLogEntry[], showName: string): string {
  const lines = [
    `${showName} — Audit Log`,
    `Generated: ${new Date().toISOString()}`,
    `Entries: ${entries.length}`,
    "",
  ];

  if (entries.length === 0) {
    lines.push("No show-scoped audit entries recorded.");
    return lines.join("\n");
  }

  for (const e of entries) {
    lines.push(`[${e.createdAt}] ${e.actionType} — ${e.entityType}${e.entityId ? ` (${e.entityId})` : ""}`);
    lines.push(`  actor: ${e.actorEmail ?? "system"} (${e.actorRole ?? "unknown role"})`);
    if (e.reason) lines.push(`  reason: ${e.reason}`);
    if (e.oldValue) lines.push(`  before: ${JSON.stringify(e.oldValue)}`);
    if (e.newValue) lines.push(`  after: ${JSON.stringify(e.newValue)}`);
    lines.push("");
  }

  return lines.join("\n");
}
