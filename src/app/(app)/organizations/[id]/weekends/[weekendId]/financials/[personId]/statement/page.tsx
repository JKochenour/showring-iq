import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { loadWeekendPersonStatement } from "@/lib/billing";
import { PrintButton } from "@/components/show/print-button";
import { StatementDocument } from "@/components/show/statement-document";
import { Alert } from "@/components/ui";

export const metadata = { title: "Weekend statement — ShowRing IQ" };

export default async function WeekendStatementPage({
  params,
}: {
  params: Promise<{ id: string; weekendId: string; personId: string }>;
}) {
  const { id, weekendId, personId } = await params;
  const { supabase } = await requireUser();

  const { data: weekend } = await supabase
    .from("show_weekends")
    .select(
      "id, name, organization_id, organization:organizations(name), shows:shows(start_date, end_date, venue_name, city, state, contact_name, contact_email, contact_phone)"
    )
    .eq("id", weekendId)
    .maybeSingle();
  if (!weekend || weekend.organization_id !== id) notFound();

  const canView = await hasOrgPermission(id, "invoice.view");
  if (!canView) {
    return <Alert>You don&apos;t have permission to view financials for this weekend.</Alert>;
  }

  const statement = await loadWeekendPersonStatement(supabase, weekendId, personId);
  if (!statement) notFound();

  const orgName = (weekend.organization as unknown as { name: string } | null)?.name ?? "";
  const shows =
    (weekend.shows as {
      start_date: string;
      end_date: string;
      venue_name: string | null;
      city: string | null;
      state: string | null;
      contact_name: string | null;
      contact_email: string | null;
      contact_phone: string | null;
    }[]) ?? [];
  const starts = shows.map((s) => s.start_date).sort();
  const ends = shows.map((s) => s.end_date).sort();
  const first = shows[0];
  const location = first
    ? [first.venue_name, first.city, first.state].filter(Boolean).join(", ")
    : "";
  const dateRange =
    starts.length > 0 ? `${starts[0]} to ${ends[ends.length - 1]}` : "";
  const subtitle = [dateRange, location].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-500 dark:text-stone-400">
          <Link
            href={`/organizations/${id}/weekends/${weekendId}/financials/${personId}`}
            className="hover:underline"
          >
            {statement.name}
          </Link>{" "}
          / Statement
        </p>
        <PrintButton />
      </div>

      <StatementDocument
        statement={statement}
        orgName={orgName}
        title={weekend.name as string}
        subtitle={subtitle}
        contact={
          first
            ? {
                name: first.contact_name,
                email: first.contact_email,
                phone: first.contact_phone,
              }
            : null
        }
      />
    </div>
  );
}
