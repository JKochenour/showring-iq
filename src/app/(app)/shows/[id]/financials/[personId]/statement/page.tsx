import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { loadPersonStatement } from "@/lib/billing";
import { PrintButton } from "@/components/show/print-button";
import { StatementDocument } from "@/components/show/statement-document";
import { Alert } from "@/components/ui";
import type { Show } from "@/lib/types";

export const metadata = { title: "Statement — ShowRing IQ" };

export default async function PersonStatementPage({
  params,
}: {
  params: Promise<{ id: string; personId: string }>;
}) {
  const { id, personId } = await params;
  const { supabase } = await requireUser();

  const { data: show } = await supabase
    .from("shows")
    .select(
      "id, organization_id, name, start_date, end_date, venue_name, city, state, contact_name, contact_email, contact_phone, organization:organizations(name)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!show) notFound();
  const s = show as Pick<
    Show,
    | "id"
    | "organization_id"
    | "name"
    | "start_date"
    | "end_date"
    | "venue_name"
    | "city"
    | "state"
    | "contact_name"
    | "contact_email"
    | "contact_phone"
  >;
  const orgName = (show.organization as unknown as { name: string } | null)?.name ?? "";

  const canView = await hasOrgPermission(s.organization_id, "invoice.view");
  if (!canView) {
    return <Alert>You don&apos;t have permission to view financials for this show.</Alert>;
  }

  const statement = await loadPersonStatement(supabase, id, personId);
  if (!statement) notFound();

  const location = [s.venue_name, s.city, s.state].filter(Boolean).join(", ");
  const subtitle = `${s.start_date} to ${s.end_date}${location ? ` · ${location}` : ""}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-500 dark:text-stone-400">
          <Link href={`/shows/${id}/financials`} className="hover:underline">
            Financials
          </Link>{" "}
          /{" "}
          <Link href={`/shows/${id}/financials/${personId}`} className="hover:underline">
            {statement.name}
          </Link>{" "}
          / Statement
        </p>
        <PrintButton />
      </div>

      <StatementDocument
        statement={statement}
        orgName={orgName}
        title={s.name}
        subtitle={subtitle}
        contact={{ name: s.contact_name, email: s.contact_email, phone: s.contact_phone }}
      />
    </div>
  );
}
