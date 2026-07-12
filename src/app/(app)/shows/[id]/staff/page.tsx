import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { AddStaffForm, RemoveStaffButton } from "@/components/show/staff-manager";
import { ClassificationSelect } from "@/components/show/classification-card";
import { Alert, Card, EmptyState } from "@/components/ui";
import { STAFF_ROLES } from "@/lib/validation/show";
import { formatCents } from "@/lib/money";
import {
  classificationForAddedMoney,
  computeClassificationChecklist,
  type ChecklistStatus,
} from "@/lib/nrha-event-classification";
import type { Show, ShowStaffRow } from "@/lib/types";

const CHECKLIST_BADGES: Record<
  ChecklistStatus,
  { symbol: string; className: string; label: string }
> = {
  pass: { symbol: "✓", className: "text-green-600 dark:text-green-400", label: "OK" },
  fail: { symbol: "✕", className: "text-red-600 dark:text-red-400", label: "Missing" },
  warning: { symbol: "!", className: "text-amber-600 dark:text-amber-400", label: "Check" },
  manual: { symbol: "○", className: "text-stone-400", label: "Confirm manually" },
};

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
    .select("id, organization_id, status, event_classification")
    .eq("id", id)
    .maybeSingle();
  if (!show) notFound();
  const s = show as Pick<
    Show,
    "id" | "organization_id" | "status" | "event_classification"
  >;

  const [
    { data: staffBase },
    { data: members },
    { data: classes },
    { data: entries },
    canEdit,
  ] = await Promise.all([
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
    supabase
      .from("classes")
      .select("id, class_number, name, added_money_cents")
      .eq("show_id", id),
    supabase.from("entries").select("rider_name").eq("show_id", id),
    hasOrgPermission(s.organization_id, "show.edit"),
  ]);

  const classIds = (classes ?? []).map((c) => c.id as string);
  const { data: classJudges } =
    classIds.length > 0
      ? await supabase.from("class_judges").select("class_id").in("class_id", classIds)
      : { data: [] as { class_id: string }[] };

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

  const judgeCountByClass = new Map<string, number>();
  for (const cj of classJudges ?? []) {
    judgeCountByClass.set(
      cj.class_id,
      (judgeCountByClass.get(cj.class_id) ?? 0) + 1
    );
  }
  const totalAddedCents = (classes ?? []).reduce(
    (sum, c) => sum + ((c.added_money_cents as number) ?? 0),
    0
  );
  const checklist = computeClassificationChecklist({
    declared: s.event_classification,
    totalAddedCents,
    staff: (staffBase ?? []).map((m) => ({
      role: m.staff_role as string,
      userId: (m.user_id as string | null) ?? null,
      displayName: m.display_name as string,
    })),
    classes: (classes ?? []).map((c) => ({
      classNumber: c.class_number as number,
      name: c.name as string,
      addedMoneyCents: (c.added_money_cents as number) ?? 0,
      judgeCount: judgeCountByClass.get(c.id as string) ?? 0,
    })),
    riderNames: [...new Set((entries ?? []).map((e) => e.rider_name as string))],
  });

  return (
    <div className="space-y-6">
      {canEdit && !editable && (
        <Alert tone="info">
          This show is {s.status}. Unlock or restore it to change staff.
        </Alert>
      )}
      {editable && <AddStaffForm showId={id} members={memberOptions} />}

      <Card>
        <h2 className="mb-1 text-base font-semibold">
          NRHA event classification
        </h2>
        <p className="mb-4 text-xs text-stone-500 dark:text-stone-400">
          Show Rules G(10). Total added money across this show:{" "}
          {formatCents(totalAddedCents)} — implies a{" "}
          {classificationForAddedMoney(totalAddedCents)} event. Validation
          assistance only — final responsibility remains with show management
          and NRHA.
        </p>
        <ClassificationSelect
          showId={id}
          classification={s.event_classification}
          canEdit={editable}
        />
        <ul className="mt-4 space-y-2 border-t border-stone-200 pt-4 dark:border-stone-800">
          {checklist.map((item, i) => {
            const badge = CHECKLIST_BADGES[item.status];
            return (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span
                  className={`mt-0.5 w-4 shrink-0 text-center font-bold ${badge.className}`}
                  title={badge.label}
                >
                  {badge.symbol}
                </span>
                <span>
                  {item.label}
                  {item.status === "manual" && (
                    <span className="ml-1 text-xs text-stone-400">
                      (confirm manually)
                    </span>
                  )}
                  {item.detail && (
                    <span className="block text-xs text-stone-500 dark:text-stone-400">
                      {item.detail}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

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
