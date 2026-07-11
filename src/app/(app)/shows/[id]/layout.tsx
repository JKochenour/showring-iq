import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authz";
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

  const tabs = [
    { href: `/shows/${id}/dashboard`, label: "Dashboard" },
    { href: `/shows/${id}/classes`, label: "Classes" },
    { href: `/shows/${id}/entries`, label: "Entries" },
    { href: `/shows/${id}/check-in`, label: "Check-in" },
    { href: `/shows/${id}/issues`, label: "Issues" },
    { href: `/shows/${id}/draws`, label: "Draws" },
    { href: `/shows/${id}/scoring`, label: "Scoring" },
    { href: `/shows/${id}/results`, label: "Results" },
    { href: `/shows/${id}/exports`, label: "Exports" },
    { href: `/shows/${id}/gate`, label: "Gate" },
    { href: `/shows/${id}/announcer`, label: "Announcer" },
    { href: `/shows/${id}/staff`, label: "Staff" },
    { href: `/shows/${id}/settings`, label: "Settings" },
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
        <nav className="mt-4 flex gap-1 border-b border-stone-200 dark:border-stone-800">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="rounded-t-md px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
