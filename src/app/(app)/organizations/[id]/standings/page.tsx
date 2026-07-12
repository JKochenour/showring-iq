import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { loadYearEndStandings } from "@/lib/standings";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui";
import { formatCents } from "@/lib/money";
import type { RulePackage } from "@/lib/types";

export const metadata = { title: "Standings — ShowRing IQ" };

export default async function StandingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string; rulePackageId?: string }>;
}) {
  const { id } = await params;
  const { year: yearParam, rulePackageId } = await searchParams;
  const { supabase } = await requireUser();

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!org) notFound();

  const canView = await hasOrgPermission(id, "rules.view");
  if (!canView) {
    return <Alert>You don&apos;t have permission to view standings.</Alert>;
  }

  const currentYear = new Date().getUTCFullYear();
  const year = yearParam ? parseInt(yearParam, 10) : currentYear;

  const [{ data: packages }, { categories, showCount }] = await Promise.all([
    supabase
      .from("association_rule_packages")
      .select("*, association:associations(name)")
      .eq("organization_id", id)
      .order("year", { ascending: false }),
    loadYearEndStandings(supabase, id, year, rulePackageId || undefined),
  ]);

  const packageRows =
    (packages as unknown as (RulePackage & { association: { name: string } | null })[]) ?? [];

  const yearOptions = new Set([currentYear, currentYear - 1, currentYear - 2, year]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Standings"
        description="Cross-show year-end / high-point standings — one horse/one rider, aggregated from every result flagged to count toward year-end awards (Classes → class detail → affiliations)."
      />

      <Alert tone="info">
        Validation assistance based on configured rule package. Only classes
        with a class affiliation marked &quot;counts for year-end&quot; are
        included, and a class only contributes if it had at least 3 entered
        horses. Points are computed from each rule package&apos;s points
        schedule — set on the rule package page; blank means 0 points for
        every placing.
      </Alert>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-500 dark:text-stone-400">
            Year
          </label>
          <select
            name="year"
            defaultValue={String(year)}
            className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
          >
            {[...yearOptions]
              .sort((a, b) => b - a)
              .map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-500 dark:text-stone-400">
            Rule package
          </label>
          <select
            name="rulePackageId"
            defaultValue={rulePackageId ?? ""}
            className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
          >
            <option value="">All rule packages</option>
            {packageRows.map((p) => (
              <option key={p.id} value={p.id}>
                {p.association?.name} {p.year} v{p.version}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:hover:bg-stone-800"
        >
          Update
        </button>
      </form>

      <p className="text-sm text-stone-500 dark:text-stone-400">
        {showCount} show{showCount === 1 ? "" : "s"} found in {year}.
      </p>

      {categories.length === 0 ? (
        <EmptyState
          title="No standings yet"
          description={
            showCount === 0
              ? `No shows found for ${year}.`
              : "No class is flagged to count toward year-end standings, or no qualifying results exist yet (needs 3+ entered horses in the class)."
          }
        />
      ) : (
        categories.map((cat) => (
          <Card key={cat.classCodeId}>
            <h3 className="mb-3 text-base font-semibold">
              {cat.code} — {cat.name}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500 dark:border-stone-800 dark:text-stone-400">
                    <th className="py-2 pr-4 font-medium">#</th>
                    <th className="py-2 pr-4 font-medium">Rider / Horse</th>
                    <th className="py-2 pr-4 font-medium">Runs</th>
                    <th className="py-2 pr-4 font-medium">Money won</th>
                    <th className="py-2 font-medium">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {cat.rows.map((row, i) => (
                    <tr key={`${row.riderPersonId}-${row.horseId}`}>
                      <td className="py-2 pr-4 font-mono">{i + 1}</td>
                      <td className="py-2 pr-4">
                        <p className="font-medium">{row.riderName}</p>
                        <p className="text-xs text-stone-500 dark:text-stone-400">
                          {row.horseName}
                        </p>
                      </td>
                      <td className="py-2 pr-4">{row.runsCounted}</td>
                      <td className="py-2 pr-4 font-mono">
                        {formatCents(row.moneyWonCents)}
                      </td>
                      <td className="py-2 font-mono">{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
