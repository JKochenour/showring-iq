import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { SignOutButton } from "@/components/sign-out-button";

export default async function ExhibitorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const { supabase, user } = await requireUser();

  const [{ data: org }, { data: person }] = await Promise.all([
    supabase.from("organizations").select("id, name").eq("id", orgId).maybeSingle(),
    supabase
      .from("people")
      .select("id, first_name, last_name")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!org || !person) notFound();

  const basePath = `/exhibitor/${orgId}`;
  const tabs = [
    { href: `${basePath}/dashboard`, label: "Dashboard" },
    { href: `${basePath}/shows`, label: "Enter a show" },
    { href: `${basePath}/entries`, label: "My entries" },
    { href: `${basePath}/horses`, label: "My horses" },
    { href: `${basePath}/profile`, label: "My profile" },
  ];

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-4 py-6 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            <Link href="/exhibitor" className="hover:underline">
              Exhibitor
            </Link>{" "}
            / {org.name}
          </p>
          <h1 className="text-xl font-semibold tracking-tight">
            {person.first_name} {person.last_name}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <nav className="flex gap-1 text-sm">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className="rounded-md px-3 py-2 font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                {tab.label}
              </Link>
            ))}
          </nav>
          <SignOutButton />
        </div>
      </div>
      {children}
    </div>
  );
}
