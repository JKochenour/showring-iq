import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { ShowTabs } from "@/components/show/show-tabs";
import { StatusBadge } from "@/components/show/show-status-actions";
import type { Show } from "@/lib/types";

export default async function ShowLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: show } = await supabase
    .from("shows")
    .select("id, name, status, organization_id, organization:organizations(name)")
    .eq("id", id)
    .maybeSingle();

  if (!show) notFound();

  const orgName =
    (show.organization as unknown as { name: string } | null)?.name ?? "";

  // Grouped by the stage of the show each section belongs to, so there are
  // five things to choose from instead of eighteen to scan.
  const tabGroups = [
    {
      label: "Dashboard",
      tabs: [{ href: `/shows/${id}/dashboard`, label: "Dashboard" }],
    },
    {
      label: "Set up",
      tabs: [
        { href: `/shows/${id}/classes`, label: "Classes" },
        { href: `/shows/${id}/schedule`, label: "Schedule" },
        { href: `/shows/${id}/staff`, label: "Staff" },
        { href: `/shows/${id}/settings`, label: "Settings" },
      ],
    },
    {
      label: "Entries",
      tabs: [
        { href: `/shows/${id}/entries`, label: "Entries" },
        { href: `/shows/${id}/check-in`, label: "Check-in" },
        { href: `/shows/${id}/issues`, label: "Issues" },
        { href: `/shows/${id}/reservations`, label: "Reservations" },
      ],
    },
    {
      label: "Run the show",
      tabs: [
        { href: `/shows/${id}/draws`, label: "Draws" },
        { href: `/shows/${id}/gate`, label: "Gate" },
        { href: `/shows/${id}/scoring`, label: "Scoring" },
        { href: `/shows/${id}/announcer`, label: "Announcer" },
        { href: `/shows/${id}/announcements`, label: "Announcements" },
      ],
    },
    {
      label: "Results & money",
      tabs: [
        { href: `/shows/${id}/results`, label: "Results" },
        { href: `/shows/${id}/financials`, label: "Financials" },
        { href: `/shows/${id}/exports`, label: "Exports" },
        { href: `/shows/${id}/reports`, label: "Reports" },
      ],
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-stone-500 dark:text-stone-400">
          <Link href="/organizations" className="hover:underline">
            Organizations
          </Link>{" "}
          /{" "}
          <Link
            href={`/organizations/${show.organization_id}/shows`}
            className="hover:underline"
          >
            {orgName}
          </Link>{" "}
          / {show.name}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{show.name}</h1>
          <StatusBadge status={show.status as Show["status"]} />
        </div>
        <ShowTabs groups={tabGroups} />
      </div>
      {children}
    </div>
  );
}
