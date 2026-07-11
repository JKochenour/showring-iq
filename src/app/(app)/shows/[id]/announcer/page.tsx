import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { loadClassDraw } from "@/lib/load-draw";
import { AutoRefresh } from "@/components/auto-refresh";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import type { ShowClass } from "@/lib/types";

export const metadata = { title: "Announcer — ShowRing IQ" };

export default async function AnnouncerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ class?: string }>;
}) {
  const { id } = await params;
  const { class: selectedClassId } = await searchParams;
  const { supabase } = await requireUser();

  const { data: show } = await supabase
    .from("shows")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!show) notFound();

  const { data: drawnClassRows } = await supabase
    .from("class_draws")
    .select("class_id")
    .eq("show_id", id);

  const drawnClassIds = [
    ...new Set((drawnClassRows ?? []).map((r) => r.class_id)),
  ];

  const { data: classes } =
    drawnClassIds.length > 0
      ? await supabase
          .from("classes")
          .select("*")
          .in("id", drawnClassIds)
          .order("display_order")
      : { data: [] };

  const classList = (classes as ShowClass[]) ?? [];
  const selected =
    classList.find((c) => c.id === selectedClassId) ?? classList[0] ?? null;

  const rows = selected ? await loadClassDraw(supabase, id, selected.id) : [];
  const current = rows.find((r) => r.run_status === "in_arena") ?? null;
  const next = rows
    .filter(
      (r) =>
        ["pending", "at_gate"].includes(r.run_status) &&
        r.entryClassStatus === "entered"
    )
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={10} />
      <PageHeader
        title="Announcer"
        description="Read-only. Refreshes automatically every 10 seconds."
      />

      {classList.length === 0 ? (
        <EmptyState
          title="Nothing running"
          description="This screen lights up once a class has a draw."
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {classList.map((cls) => (
              <Link
                key={cls.id}
                href={`/shows/${id}/announcer?class=${cls.id}`}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  selected?.id === cls.id
                    ? "border-brand-700 bg-brand-700 text-white"
                    : "border-stone-300 text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
                }`}
              >
                {cls.class_number} — {cls.name}
              </Link>
            ))}
          </div>

          {selected && (
            <>
              <Card className="border-brand-600 dark:border-brand-500">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Now in the arena — Class {selected.class_number},{" "}
                  {selected.name}
                  {selected.pattern_number &&
                    `, Pattern ${selected.pattern_number}`}
                </p>
                {current ? (
                  <div className="mt-2">
                    <p className="font-mono text-5xl font-bold">
                      {current.backNumber ? `#${current.backNumber}` : "—"}
                    </p>
                    <p className="mt-2 text-2xl font-semibold">
                      {current.riderName}
                    </p>
                    <p className="text-lg text-stone-600 dark:text-stone-300">
                      riding {current.horseName}
                    </p>
                    <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                      {current.ownerName && `Owned by ${current.ownerName}`}
                      {current.trainerName &&
                        ` · Trained by ${current.trainerName}`}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-lg text-stone-400">
                    No horse in the arena right now
                  </p>
                )}
              </Card>

              <Card>
                <h3 className="mb-3 text-base font-semibold">Coming up</h3>
                {next.length === 0 ? (
                  <p className="text-sm text-stone-500 dark:text-stone-400">
                    No runs remaining in this class.
                  </p>
                ) : (
                  <ul className="divide-y divide-stone-200 dark:divide-stone-800">
                    {next.map((row, index) => (
                      <li key={row.id} className="flex items-center gap-4 py-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                          {index === 0 ? "On deck" : `${index + 1} away`}
                        </span>
                        <span className="font-mono text-xl font-bold">
                          {row.backNumber ? `#${row.backNumber}` : "—"}
                        </span>
                        <div>
                          <p className="text-sm font-medium">{row.riderName}</p>
                          <p className="text-xs text-stone-500 dark:text-stone-400">
                            {row.horseName}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
