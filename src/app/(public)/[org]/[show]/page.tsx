import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { formatScore } from "@/lib/score";
import {
  loadPublicClassDraw,
  loadPublicClassResults,
  loadPublicClassScores,
  loadPublicClasses,
  loadPublicShow,
  publicClassStage,
  type PublicClass,
} from "@/lib/public-results";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ org: string; show: string }>;
}) {
  const { org, show } = await params;
  const supabase = await createClient();
  const showRow = await loadPublicShow(supabase, org, show);
  if (!showRow) return { title: "Show not found — ShowRing IQ" };
  return { title: `${showRow.name} — ShowRing IQ` };
}

const STAGE_LABEL: Record<string, { label: string; tone: "neutral" | "brand" | "success" | "danger" }> = {
  not_started: { label: "Not started", tone: "neutral" },
  running: { label: "Running", tone: "brand" },
  results_posted: { label: "Results posted", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export default async function PublicShowPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; show: string }>;
  searchParams: Promise<{ class?: string }>;
}) {
  const { org, show } = await params;
  const { class: selectedClassId } = await searchParams;
  const supabase = await createClient();

  const showRow = await loadPublicShow(supabase, org, show);
  if (!showRow) notFound();

  const classes = await loadPublicClasses(supabase, showRow.id);
  const selected =
    classes.find((c) => c.id === selectedClassId) ??
    classes.find((c) => publicClassStage(c.status) === "running") ??
    classes[0] ??
    null;

  const [draw, scores, results] = selected
    ? await Promise.all([
        loadPublicClassDraw(supabase, showRow.id, selected.id),
        loadPublicClassScores(supabase, showRow.id, selected.id),
        publicClassStage(selected.status) === "results_posted"
          ? loadPublicClassResults(supabase, showRow.id, selected.id)
          : Promise.resolve([]),
      ])
    : [[], [], []];

  const current = draw.find((r) => r.run_status === "in_arena") ?? null;
  const next = draw
    .filter(
      (r) =>
        ["pending", "at_gate"].includes(r.run_status) &&
        r.entry_class_status === "entered"
    )
    .slice(0, 3);
  const recentScores = [...scores].reverse();

  const dateRange =
    showRow.start_date === showRow.end_date
      ? showRow.start_date
      : `${showRow.start_date} – ${showRow.end_date}`;
  const location = [showRow.venue_name, showRow.city, showRow.state]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={15} />
      <div>
        <p className="text-sm font-medium text-stone-500 dark:text-stone-400">
          {showRow.organization_name}
        </p>
        <PageHeader title={showRow.name} description={[dateRange, location].filter(Boolean).join(" · ")} />
        {showRow.description && (
          <p className="-mt-4 mb-6 text-sm text-stone-600 dark:text-stone-300">
            {showRow.description}
          </p>
        )}
      </div>

      {classes.length === 0 ? (
        <EmptyState
          title="No classes posted yet"
          description="Check back once the show publishes its schedule."
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {classes.map((cls) => (
              <ClassChip
                key={cls.id}
                cls={cls}
                orgSlug={org}
                showSlug={show}
                selected={selected?.id === cls.id}
              />
            ))}
          </div>

          {selected && (
            <>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl font-semibold text-stone-900 dark:text-stone-50">
                  Class {selected.class_number} — {selected.name}
                </h2>
                <Badge tone={STAGE_LABEL[publicClassStage(selected.status)].tone}>
                  {STAGE_LABEL[publicClassStage(selected.status)].label}
                </Badge>
              </div>

              {publicClassStage(selected.status) === "not_started" && (
                <EmptyState
                  title="This class hasn't started"
                  description="Draw order and live scores will appear here once it's underway."
                />
              )}

              {publicClassStage(selected.status) === "running" && (
                <>
                  <Card className="border-brand-600 dark:border-brand-500">
                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                      Now in the arena
                    </p>
                    {current ? (
                      <div className="mt-2">
                        <p className="font-mono text-5xl font-bold">
                          {current.back_number ? `#${current.back_number}` : "—"}
                        </p>
                        <p className="mt-2 text-2xl font-semibold">{current.rider_name}</p>
                        <p className="text-lg text-stone-600 dark:text-stone-300">
                          riding {current.horse_name}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-2 text-lg text-stone-400">No horse in the arena right now</p>
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
                          <li key={row.position} className="flex items-center gap-4 py-3">
                            <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                              {index === 0 ? "On deck" : `${index + 1} away`}
                            </span>
                            <span className="font-mono text-xl font-bold">
                              {row.back_number ? `#${row.back_number}` : "—"}
                            </span>
                            <div>
                              <p className="text-sm font-medium">{row.rider_name}</p>
                              <p className="text-xs text-stone-500 dark:text-stone-400">
                                {row.horse_name}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>

                  <Card>
                    <h3 className="mb-3 text-base font-semibold">Live scores</h3>
                    {recentScores.length === 0 ? (
                      <p className="text-sm text-stone-500 dark:text-stone-400">
                        No scores signed yet.
                      </p>
                    ) : (
                      <ul className="divide-y divide-stone-200 dark:divide-stone-800">
                        {recentScores.map((row, i) => (
                          <li key={i} className="flex items-center gap-4 py-3">
                            <span className="font-mono text-xl font-bold">
                              {row.back_number ? `#${row.back_number}` : "—"}
                            </span>
                            <div className="flex-1">
                              <p className="text-sm font-medium">{row.rider_name}</p>
                              <p className="text-xs text-stone-500 dark:text-stone-400">
                                {row.horse_name}
                              </p>
                            </div>
                            <span className="font-mono text-lg font-semibold">
                              {row.result_status === "shown" || row.result_status === "zero"
                                ? formatScore(row.total_score_tenths)
                                : row.result_status.replace("_", " ")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                </>
              )}

              {publicClassStage(selected.status) === "results_posted" && (
                <Card>
                  <h3 className="mb-3 text-base font-semibold">Results</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-stone-200 text-left text-xs font-semibold uppercase tracking-wide text-stone-400 dark:border-stone-800">
                          <th className="py-2 pr-4">Place</th>
                          <th className="py-2 pr-4">Back #</th>
                          <th className="py-2 pr-4">Rider</th>
                          <th className="py-2 pr-4">Horse</th>
                          <th className="py-2 pr-4">Score</th>
                          <th className="py-2">Money won</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                        {results.map((row, i) => (
                          <tr key={i}>
                            <td className="py-2 pr-4 font-semibold">
                              {row.placing ? row.placing : "—"}
                              {row.tie_status === "tied" && (
                                <span className="ml-1 text-xs text-stone-400">(tie)</span>
                              )}
                            </td>
                            <td className="py-2 pr-4 font-mono">
                              {row.back_number ? `#${row.back_number}` : "—"}
                            </td>
                            <td className="py-2 pr-4">{row.rider_name}</td>
                            <td className="py-2 pr-4">{row.horse_name}</td>
                            <td className="py-2 pr-4 font-mono">{formatScore(row.total_score_tenths)}</td>
                            <td className="py-2">
                              {row.money_won_cents > 0 ? formatCents(row.money_won_cents) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function ClassChip({
  cls,
  orgSlug,
  showSlug,
  selected,
}: {
  cls: PublicClass;
  orgSlug: string;
  showSlug: string;
  selected: boolean;
}) {
  return (
    <Link
      href={`/${orgSlug}/${showSlug}?class=${cls.id}`}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        selected
          ? "border-brand-700 bg-brand-700 text-white"
          : "border-stone-300 text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
      }`}
    >
      {cls.class_number} — {cls.name}
    </Link>
  );
}
