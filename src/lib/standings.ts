import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cross-show year-end / high-point standings.
 *
 * Only counts results whose class has a class_affiliations row with
 * counts_for_year_end = true (added in 00018, unused until now — the
 * office opts a class in per-affiliation on the class detail page).
 * Nothing counts by default, matching the rest of this app's
 * validate-don't-assume posture.
 *
 * "One horse/one rider" grouping (CLAUDE.md: Non Pro/Youth earnings) is
 * used for every category in this v1 — Open/Professional classes that
 * NRHA attributes to the horse alone aren't split out separately yet.
 * A class only contributes if it had at least 3 entered horses (Show
 * Rules Q(3): "a minimum of three horses must be shown... to qualify
 * for points/earnings to be recorded").
 */

export interface PointsScheduleRow {
  placing: number;
  points: number;
}

export interface StandingsRow {
  riderPersonId: string;
  riderName: string;
  horseId: string;
  horseName: string;
  moneyWonCents: number;
  points: number;
  runsCounted: number;
}

export interface StandingsCategory {
  classCodeId: string;
  code: string;
  name: string;
  rows: StandingsRow[];
}

function pointsForPlacing(schedule: PointsScheduleRow[], placing: number | null): number {
  if (!placing) return 0;
  return schedule.find((r) => r.placing === placing)?.points ?? 0;
}

export async function loadYearEndStandings(
  supabase: SupabaseClient,
  organizationId: string,
  year: number,
  rulePackageId?: string
): Promise<{ categories: StandingsCategory[]; showCount: number }> {
  const { data: shows } = await supabase
    .from("shows")
    .select("id")
    .eq("organization_id", organizationId)
    .gte("start_date", `${year}-01-01`)
    .lte("start_date", `${year}-12-31`);
  const showIds = (shows ?? []).map((s) => s.id as string);
  if (showIds.length === 0) return { categories: [], showCount: 0 };

  const { data: results } = await supabase
    .from("results")
    .select("entry_class_id, class_id, placing, money_won_cents")
    .in("show_id", showIds)
    .not("placing", "is", null);
  if (!results || results.length === 0) return { categories: [], showCount: showIds.length };

  const classIds = [...new Set(results.map((r) => r.class_id as string))];

  const [{ data: affiliations }, { data: entryClasses }, { data: enteredCounts }] =
    await Promise.all([
      supabase
        .from("class_affiliations")
        .select(
          "class_id, association_class_code_id, counts_for_year_end, is_primary, association_class_codes(id, code, name, rule_package_id)"
        )
        .in("class_id", classIds)
        .eq("counts_for_year_end", true),
      supabase
        .from("entry_classes")
        .select("id, entry_id, entries(rider_person_id, rider_name, horse_id, horse_name)")
        .in(
          "id",
          results.map((r) => r.entry_class_id as string)
        ),
      supabase.from("entry_classes").select("class_id").in("class_id", classIds).eq("status", "entered"),
    ]);

  if (!affiliations || affiliations.length === 0) {
    return { categories: [], showCount: showIds.length };
  }

  const enteredCountByClass = new Map<string, number>();
  for (const ec of enteredCounts ?? []) {
    const cid = ec.class_id as string;
    enteredCountByClass.set(cid, (enteredCountByClass.get(cid) ?? 0) + 1);
  }

  const affiliationsByClass = new Map<string, typeof affiliations>();
  for (const a of affiliations) {
    if (rulePackageId) {
      const code = a.association_class_codes as unknown as {
        rule_package_id: string;
      } | null;
      if (code?.rule_package_id !== rulePackageId) continue;
    }
    const list = affiliationsByClass.get(a.class_id as string) ?? [];
    list.push(a);
    affiliationsByClass.set(a.class_id as string, list);
  }

  const rulePackageIds = [
    ...new Set(
      affiliations
        .map(
          (a) =>
            (a.association_class_codes as unknown as { rule_package_id: string } | null)
              ?.rule_package_id
        )
        .filter((v): v is string => !!v)
    ),
  ];
  const { data: rulePackages } = rulePackageIds.length
    ? await supabase
        .from("association_rule_packages")
        .select("id, points_schedule")
        .in("id", rulePackageIds)
    : { data: [] as { id: string; points_schedule: PointsScheduleRow[] }[] };
  const scheduleByRulePackage = new Map(
    (rulePackages ?? []).map((p) => [p.id as string, (p.points_schedule as PointsScheduleRow[]) ?? []])
  );

  const entryByEntryClass = new Map(
    (entryClasses ?? []).map((ec) => [
      ec.id as string,
      ec.entries as unknown as {
        rider_person_id: string;
        rider_name: string;
        horse_id: string;
        horse_name: string;
      } | null,
    ])
  );

  interface Bucket {
    classCodeId: string;
    code: string;
    name: string;
    riderPersonId: string;
    riderName: string;
    horseId: string;
    horseName: string;
    moneyWonCents: number;
    points: number;
    runsCounted: number;
  }
  const buckets = new Map<string, Bucket>();

  for (const r of results) {
    const classId = r.class_id as string;
    if ((enteredCountByClass.get(classId) ?? 0) < 3) continue;

    const classAffiliations = affiliationsByClass.get(classId);
    if (!classAffiliations || classAffiliations.length === 0) continue;

    const entry = entryByEntryClass.get(r.entry_class_id as string);
    if (!entry) continue;

    for (const a of classAffiliations) {
      const code = a.association_class_codes as unknown as {
        id: string;
        code: string;
        name: string;
        rule_package_id: string;
      } | null;
      if (!code) continue;

      const schedule = scheduleByRulePackage.get(code.rule_package_id) ?? [];
      const key = `${code.id}::${entry.rider_person_id}::${entry.horse_id}`;
      const bucket = buckets.get(key) ?? {
        classCodeId: code.id,
        code: code.code,
        name: code.name,
        riderPersonId: entry.rider_person_id,
        riderName: entry.rider_name,
        horseId: entry.horse_id,
        horseName: entry.horse_name,
        moneyWonCents: 0,
        points: 0,
        runsCounted: 0,
      };
      bucket.moneyWonCents += (r.money_won_cents as number) ?? 0;
      bucket.points += pointsForPlacing(schedule, r.placing as number | null);
      bucket.runsCounted += 1;
      buckets.set(key, bucket);
    }
  }

  const byCategory = new Map<string, StandingsCategory>();
  for (const b of buckets.values()) {
    const cat = byCategory.get(b.classCodeId) ?? {
      classCodeId: b.classCodeId,
      code: b.code,
      name: b.name,
      rows: [],
    };
    cat.rows.push({
      riderPersonId: b.riderPersonId,
      riderName: b.riderName,
      horseId: b.horseId,
      horseName: b.horseName,
      moneyWonCents: b.moneyWonCents,
      points: b.points,
      runsCounted: b.runsCounted,
    });
    byCategory.set(b.classCodeId, cat);
  }

  const categories = [...byCategory.values()]
    .map((c) => ({
      ...c,
      rows: c.rows.sort((a, b) => b.moneyWonCents - a.moneyWonCents || b.points - a.points),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { categories, showCount: showIds.length };
}
