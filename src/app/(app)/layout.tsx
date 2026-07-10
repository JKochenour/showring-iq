import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { SignOutButton } from "@/components/sign-out-button";
import { HelpChatWidget } from "@/components/help/help-chat-widget";
import { OrgSidebarNav } from "@/components/org/org-sidebar-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, user } = await requireUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("organization:organizations(id, name)")
    .eq("user_id", user.id)
    .eq("status", "active");

  const orgs =
    memberships
      ?.map((m) => m.organization as unknown as { id: string; name: string })
      .filter(Boolean) ?? [];

  const { data: shows } =
    orgs.length > 0
      ? await supabase
          .from("shows")
          .select("id, name, organization_id")
          .in(
            "organization_id",
            orgs.map((o) => o.id)
          )
          .order("start_date", { ascending: false })
      : { data: [] as { id: string; name: string; organization_id: string }[] };

  const showsByOrg = new Map<string, { id: string; name: string }[]>();
  for (const s of shows ?? []) {
    const list = showsByOrg.get(s.organization_id) ?? [];
    list.push({ id: s.id, name: s.name });
    showsByOrg.set(s.organization_id, list);
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-zinc-200 bg-white px-4 py-6 dark:border-zinc-800 dark:bg-zinc-900 sm:flex">
        <Link href="/dashboard" className="mb-8 px-2 text-lg font-bold tracking-tight">
          ShowRing <span className="text-emerald-700">IQ</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 text-sm">
          <Link
            href="/dashboard"
            className="rounded-md px-2 py-2 font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Dashboard
          </Link>
          <Link
            href="/organizations"
            className="rounded-md px-2 py-2 font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Organizations
          </Link>
          {orgs.length > 0 && (
            <div className="mt-4">
              <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Your organizations
              </p>
              {orgs.map((org) => (
                <OrgSidebarNav
                  key={org.id}
                  org={org}
                  shows={showsByOrg.get(org.id) ?? []}
                />
              ))}
            </div>
          )}
          <Link
            href="/help"
            className="mt-4 rounded-md px-2 py-2 font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Help &amp; Support
          </Link>
        </nav>
        <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <p className="truncate px-2 text-sm font-medium">
            {profile?.full_name || profile?.email || user.email}
          </p>
          <div className="px-2 pt-1">
            <SignOutButton />
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900 sm:hidden">
          <Link href="/dashboard" className="text-lg font-bold tracking-tight">
            ShowRing <span className="text-emerald-700">IQ</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/organizations" className="font-medium">
              Orgs
            </Link>
            <Link href="/help" className="font-medium">
              Help
            </Link>
            <SignOutButton />
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-8">
          {children}
        </main>
      </div>
      <HelpChatWidget />
    </div>
  );
}
