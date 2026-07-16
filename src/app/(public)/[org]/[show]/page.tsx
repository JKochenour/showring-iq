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
  type PublicDrawRow,
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
          <Link href={`/${org}`} className="hover:underline">
            {showRow.organization_name}
          </Link>
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
          <ScheduleByDay
            classes={classes}
            orgSlug={org}
            showSlug={show}
            selectedId={selected?.id ?? null}
          />

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

              {selected.concurrent_group_id && (
                <ConcurrentSiblings
                  classes={classes}
                  selected={selected}
                  orgSlug={org}
                  showSlug={show}
                />
              )}

              {publicClassStage(selected.status) === "not_started" &&
                (draw.length > 0 ? (
                  <OrderOfGo draw={draw} />
                ) : (
                  <EmptyState
                    title="This class hasn't started"
                    description="Draw order and live scores will appear here once it's underway."
                  />
                ))}

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

                  {draw.length > 0 && <OrderOfGo draw={draw} />}
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

/** The schedule, grouped the way the printed show bill reads: one
 * section per scheduled day, one chip per RUN. A concurrent group shows
 * only its LEAD class (first by display_order — e.g. "Open", not
 * "Open + Int Open + Ltd Open + Rookie Pro"); the siblings appear in
 * the detail area once the run is selected. Classes with no scheduled
 * day land in a trailing "Not yet scheduled" group. */
function ScheduleByDay({
  classes,
  orgSlug,
  showSlug,
  selectedId,
}: {
  classes: PublicClass[];
  orgSlug: string;
  showSlug: string;
  selectedId: string | null;
}) {
  // classes arrive in display_order; Maps preserve that order.
  const days = new Map<string, Map<string, PublicClass[]>>();
  for (const cls of classes) {
    const day = cls.scheduled_date ?? "";
    if (!days.has(day)) days.set(day, new Map());
    const runs = days.get(day)!;
    const runKey = cls.concurrent_group_id ?? `solo-${cls.id}`;
    if (!runs.has(runKey)) runs.set(runKey, []);
    runs.get(runKey)!.push(cls);
  }
  const schedule = [...days.entries()]
    .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)))
    .map(([day, runs]) => ({ day, runs: [...runs.values()] }));

  return (
    <div className="space-y-5">
      {schedule.map(({ day, runs }) => (
        <div key={day || "unscheduled"}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            {day
              ? new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
                  timeZone: "UTC",
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
              : "Not yet scheduled"}
          </h3>
          <div className="flex flex-col gap-1.5">
            {runs.map((run) => (
              <div key={run[0].id}>
                <ClassChip
                  cls={run[0]}
                  orgSlug={orgSlug}
                  showSlug={showSlug}
                  selected={run.some((cls) => cls.id === selectedId)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Classes sharing the selected class's physical go (concurrent group).
 * The schedule lists only the run's lead class, so this is where the
 * sibling classes stay reachable — each has its own placings/results. */
function ConcurrentSiblings({
  classes,
  selected,
  orgSlug,
  showSlug,
}: {
  classes: PublicClass[];
  selected: PublicClass;
  orgSlug: string;
  showSlug: string;
}) {
  const siblings = classes.filter(
    (c) =>
      c.concurrent_group_id === selected.concurrent_group_id &&
      c.id !== selected.id
  );
  if (siblings.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-stone-500 dark:text-stone-400">
      <span>Also in this go:</span>
      {siblings.map((cls) => (
        <Link
          key={cls.id}
          href={`/${orgSlug}/${showSlug}?class=${cls.id}`}
          className="rounded-full border border-stone-300 px-2.5 py-0.5 text-xs font-medium text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
        >
          {cls.class_number} — {cls.name}
        </Link>
      ))}
    </div>
  );
}

/** The full draw sheet — what exhibitors check the night before. Shows
 * every run in order with its live status; scratches stay visible but
 * struck through, completed runs dim, the in-arena run highlights. */
function OrderOfGo({ draw }: { draw: PublicDrawRow[] }) {
  return (
    <Card>
      <h3 className="mb-3 text-base font-semibold">Order of go</h3>
      <ul className="divide-y divide-stone-200 dark:divide-stone-800">
        {draw.map((row) => {
          const scratched =
            row.entry_class_status === "scratched" ||
            row.run_status === "scratched";
          const done = row.run_status === "completed";
          const inArena = row.run_status === "in_arena";
          return (
            <li
              key={row.position}
              className={`flex items-center gap-4 py-2.5 ${
                inArena
                  ? "-mx-2 rounded-md bg-brand-50 px-2 dark:bg-brand-950/40"
                  : ""
              } ${done ? "opacity-50" : ""}`}
            >
              <span className="w-8 shrink-0 text-right font-mono text-sm text-stone-400">
                {row.position}
              </span>
              <span className="w-14 shrink-0 font-mono text-lg font-bold">
                {row.back_number ? `#${row.back_number}` : "—"}
              </span>
              <div className="flex-1">
                <p
                  className={`text-sm font-medium ${
                    scratched
                      ? "text-stone-400 line-through dark:text-stone-500"
                      : ""
                  }`}
                >
                  {row.rider_name}
                </p>
                <p
                  className={`text-xs text-stone-500 dark:text-stone-400 ${
                    scratched ? "line-through" : ""
                  }`}
                >
                  {row.horse_name}
                </p>
              </div>
              <span className="text-xs font-medium uppercase tracking-wide text-stone-400">
                {scratched
                  ? "Scratched"
                  : inArena
                    ? "In arena"
                    : done
                      ? "Done"
                      : row.run_status === "at_gate"
                        ? "At gate"
                        : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
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
  const stage = publicClassStage(cls.status);
  return (
    <Link
      href={`/${orgSlug}/${showSlug}?class=${cls.id}`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
        selected
          ? "border-brand-700 bg-brand-700 text-white"
          : "border-stone-300 text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
      }`}
    >
      {stage === "running" && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            selected ? "bg-white" : "bg-brand-600 dark:bg-brand-400"
          }`}
          title="Running"
        />
      )}
      {stage === "results_posted" && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            selected ? "bg-white" : "bg-green-600 dark:bg-green-400"
          }`}
          title="Results posted"
        />
      )}
      {cls.class_number} — {cls.name}
    </Link>
  );
}
