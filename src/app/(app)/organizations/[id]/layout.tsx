import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authz";

export default async function OrganizationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  // RLS: non-members get no row back
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("id", id)
    .maybeSingle();

  if (!org) notFound();

  const tabs = [
    { href: `/organizations/${id}`, label: "Overview" },
    { href: `/organizations/${id}/shows`, label: "Shows" },
    { href: `/organizations/${id}/weekends`, label: "Weekends" },
    { href: `/organizations/${id}/people`, label: "People" },
    { href: `/organizations/${id}/horses`, label: "Horses" },
    { href: `/organizations/${id}/rule-packages`, label: "Rule Packages" },
    { href: `/organizations/${id}/standings`, label: "Standings" },
    { href: `/organizations/${id}/payee-report`, label: "Payee Report" },
    { href: `/organizations/${id}/members`, label: "Members" },
    { href: `/organizations/${id}/settings`, label: "Settings" },
    { href: `/organizations/${id}/audit`, label: "Audit log" },
  ];

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-stone-500 dark:text-stone-400">
          <Link href="/organizations" className="hover:underline">
            Organizations
          </Link>{" "}
          / {org.name}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{org.name}</h1>
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
