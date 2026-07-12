import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { CreateEntryForm } from "@/components/show/entry-form";
import { Alert, PageHeader } from "@/components/ui";
import type { Person, ShowClass } from "@/lib/types";

export const metadata = { title: "New entry — ShowRing IQ" };

export default async function NewEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: show } = await supabase
    .from("shows")
    .select("id, organization_id, status, late_entry_fee_cents")
    .eq("id", id)
    .maybeSingle();
  if (!show) notFound();

  const [{ data: people }, { data: horses }, { data: classes }, canCreate] =
    await Promise.all([
      supabase
        .from("people")
        .select("id, first_name, last_name, roles")
        .eq("organization_id", show.organization_id)
        .order("last_name"),
      supabase
        .from("horses")
        .select("id, registered_name, barn_name")
        .eq("organization_id", show.organization_id)
        .order("registered_name"),
      supabase
        .from("classes")
        .select("id, class_number, name, entry_fee_cents, status")
        .eq("show_id", id)
        .not("status", "in", "(cancelled,archived)")
        .order("display_order"),
      hasOrgPermission(show.organization_id, "entry.create"),
    ]);

  const showEditable = show.status === "draft" || show.status === "published";

  const peopleRows =
    (people as Pick<Person, "id" | "first_name" | "last_name" | "roles">[]) ??
    [];
  const byRole = (role: string) =>
    peopleRows
      .filter((p) => p.roles.includes(role))
      .map((p) => ({ id: p.id, label: `${p.last_name}, ${p.first_name}` }));

  const horseOptions =
    horses?.map((h) => ({
      id: h.id as string,
      label: h.barn_name
        ? `${h.registered_name} (“${h.barn_name}”)`
        : (h.registered_name as string),
    })) ?? [];

  const classOptions =
    (classes as Pick<
      ShowClass,
      "id" | "class_number" | "name" | "entry_fee_cents" | "status"
    >[] | null)?.map((c) => ({
      id: c.id,
      classNumber: c.class_number,
      name: c.name,
      feeCents: c.entry_fee_cents,
      status: c.status,
    })) ?? [];

  return (
    <div>
      <PageHeader
        title="New entry"
        description="Pick the rider, horse, and classes. People and horses come from the organization database."
      />
      {!canCreate || !showEditable ? (
        <Alert tone="info">
          {!showEditable
            ? `This show is ${show.status}; entries can't be added.`
            : "You don't have the entry.create permission in this organization."}
        </Alert>
      ) : (
        <CreateEntryForm
          showId={id}
          organizationId={show.organization_id}
          riders={byRole("rider")}
          owners={byRole("owner")}
          trainers={byRole("trainer")}
          horses={horseOptions}
          classes={classOptions}
          lateEntryFeeCents={show.late_entry_fee_cents ?? 0}
        />
      )}
    </div>
  );
}
