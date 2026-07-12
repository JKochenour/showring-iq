import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { ShowBillImport } from "@/components/show/show-bill-import";
import { Alert, PageHeader } from "@/components/ui";
import type { Show } from "@/lib/types";

export const metadata = { title: "Import show bill — ShowRing IQ" };

export default async function ImportBillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: show } = await supabase
    .from("shows")
    .select("id, organization_id, status, start_date")
    .eq("id", id)
    .maybeSingle();
  if (!show) notFound();
  const s = show as Pick<Show, "id" | "organization_id" | "status" | "start_date">;

  const canCreate = await hasOrgPermission(s.organization_id, "class.create");
  if (!canCreate) {
    return <Alert>You don&apos;t have permission to add classes to this show.</Alert>;
  }
  if (s.status !== "draft" && s.status !== "published") {
    return (
      <Alert tone="info">
        This show is {s.status} — unlock or restore it before importing classes.
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          <Link href={`/shows/${id}/classes`} className="hover:underline">
            Classes
          </Link>{" "}
          / Import from show bill
        </p>
        <PageHeader
          title="Import classes from a show bill"
          description="Upload the published show bill PDF (or paste its class schedule text). The day headers, arenas, start times, class names, added money, entry fees, judge fees, and patterns are parsed into a preview you can correct before anything is created."
        />
      </div>
      <ShowBillImport
        showId={id}
        defaultYear={parseInt(s.start_date.slice(0, 4), 10)}
      />
    </div>
  );
}
