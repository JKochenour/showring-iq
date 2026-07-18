import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { SignOutButton } from "@/components/sign-out-button";
import { HelpChatWidget } from "@/components/help/help-chat-widget";
import { MobileNav } from "@/components/mobile-nav";
import { OrgSidebarNav } from "@/components/org/org-sidebar-nav";
import { SidebarNavLink } from "@/components/org/sidebar-nav-link";
import { weekendShowLabels } from "@/lib/show-labels";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

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

  type ShowRow = {
    id: string;
    name: string;
    organization_id: string;
    start_date: string | null;
    weekend_id: string | null;
  };

  const { data: shows } =
    orgs.length > 0
      ? await supabase
          .from("shows")
          .select("id, name, organization_id, start_date, weekend_id")
          .in(
            "organization_id",
            orgs.map((o) => o.id)
          )
      : { data: [] as ShowRow[] };

  // Order weekends newest-first (by their latest slate's start date), but
  // order the slates WITHIN a weekend ascending so Slate 1 sits above Slate 2.
  const showRows = (shows ?? []) as ShowRow[];
  const weekendRank = new Map<string, string>();
  for (const s of showRows) {
    const key = s.weekend_id ?? s.id;
    const date = s.start_date ?? "";
    const cur = weekendRank.get(key);
    if (cur === undefined || date > cur) weekendRank.set(key, date);
  }
  const sortedShows = [...showRows].sort((a, b) => {
    const ka = a.weekend_id ?? a.id;
    const kb = b.weekend_id ?? b.id;
    const ra = weekendRank.get(ka) ?? "";
    const rb = weekendRank.get(kb) ?? "";
    if (ra !== rb) return rb.localeCompare(ra); // newer weekend first
    if (ka !== kb) return ka.localeCompare(kb); // keep weekends grouped
    const da = a.start_date ?? "";
    const db = b.start_date ?? "";
    if (da !== db) return da.localeCompare(db); // Slate 1 (earlier) first
    return a.name.localeCompare(b.name);
  });

  // Slates of the same weekend repeat the event name — show only the part
  // that differs (plus one word of context) so "Classic I" / "Classic 2"
  // fit the sidebar instead of wrapping. Weekends of one keep their name.
  const shortLabel = new Map<string, string>();
  const byWeekend = new Map<string, ShowRow[]>();
  for (const s of sortedShows) {
    if (!s.weekend_id) continue;
    const list = byWeekend.get(s.weekend_id) ?? [];
    list.push(s);
    byWeekend.set(s.weekend_id, list);
  }
  for (const slates of byWeekend.values()) {
    if (slates.length < 2) continue;
    const labels = weekendShowLabels(slates.map((s) => s.name));
    slates.forEach((s, i) => shortLabel.set(s.id, labels[i]));
  }

  const showsByOrg = new Map<
    string,
    { id: string; name: string; label: string }[]
  >();
  for (const s of sortedShows) {
    const list = showsByOrg.get(s.organization_id) ?? [];
    list.push({ id: s.id, name: s.name, label: shortLabel.get(s.id) ?? s.name });
    showsByOrg.set(s.organization_id, list);
  }

  const displayName = profile?.full_name || profile?.email || user.email || "";

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-stone-200 bg-white px-4 py-6 dark:border-stone-800 dark:bg-stone-900 sm:flex">
        <Link
          href="/dashboard"
          className="font-grotesk mb-8 px-2 text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-50"
        >
          ShowRing <span className="text-brand-600 dark:text-brand-400">IQ</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 text-sm">
          <SidebarNavLink href="/dashboard">Dashboard</SidebarNavLink>
          <SidebarNavLink href="/organizations">Organizations</SidebarNavLink>
          {orgs.length > 0 && (
            <div className="mt-4">
              <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">
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
          <div className="mt-4">
            <SidebarNavLink href="/help">Help &amp; Support</SidebarNavLink>
          </div>
        </nav>
        <div className="flex items-center gap-3 border-t border-stone-200 pt-4 dark:border-stone-800">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white">
            {initials(displayName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">
              {displayName}
            </p>
            <SignOutButton />
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-stone-200 bg-white px-4 py-2 dark:border-stone-800 dark:bg-stone-900 sm:hidden">
          <Link href="/dashboard" className="font-grotesk text-lg font-semibold tracking-tight">
            ShowRing <span className="text-brand-600 dark:text-brand-400">IQ</span>
          </Link>
          <MobileNav>
            <nav className="flex flex-col gap-1 text-sm">
              <SidebarNavLink href="/dashboard">Dashboard</SidebarNavLink>
              <SidebarNavLink href="/organizations">Organizations</SidebarNavLink>
              {orgs.length > 0 && (
                <div className="mt-4">
                  <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">
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
              <div className="mt-4">
                <SidebarNavLink href="/help">Help &amp; Support</SidebarNavLink>
              </div>
            </nav>
            <div className="mt-6 border-t border-stone-200 pt-4 dark:border-stone-800">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <SignOutButton />
            </div>
          </MobileNav>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 sm:px-8 sm:py-8">
          {children}
        </main>
      </div>
      <HelpChatWidget />
    </div>
  );
}
