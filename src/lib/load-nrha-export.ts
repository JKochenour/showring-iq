import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildNrhaCsv,
  checkNrhaReadiness,
  isExportReady,
  type NrhaCsvRow,
  type ReadinessIssue,
} from "@/lib/nrha-export";

export interface NrhaExportResult {
  showName: string;
  csv: string;
  rows: NrhaCsvRow[];
  readiness: ReadinessIssue[];
  ready: boolean;
  includedClassCount: number;
}

const INCLUDED_STATUSES = ["official", "results_posted", "exported"];

/** Loads a show's data and assembles the NRHA CSV + a readiness report.
 * Only classes that have completed scoring (official or later) are
 * included — matches the Results tab's definition of "done." */
export async function loadNrhaExportData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  showId: string
): Promise<NrhaExportResult> {
  const { data: show } = await supabase
    .from("shows")
    .select("name, nrha_show_number")
    .eq("id", showId)
    .maybeSingle();

  const { data: classesRaw } = await supabase
    .from("classes")
    .select(
      `id, class_number, name, nrha_class_code, pattern_number, go_type, go_number, status,
       affiliations:class_affiliations(association_class_code_id, counts_for_money, code:association_class_codes(code, rule_package:association_rule_packages(association:associations(name))))`
    )
    .eq("show_id", showId)
    .in("status", INCLUDED_STATUSES)
    .order("display_order");

  type AffiliationRow = {
    association_class_code_id: string;
    counts_for_money: boolean;
    code: { code: string; rule_package: { association: { name: string } | null } | null } | null;
  };
  type ClassRow = {
    id: string;
    class_number: number;
    name: string;
    nrha_class_code: string | null;
    pattern_number: number | null;
    go_type: string | null;
    go_number: number | null;
    status: string;
    affiliations: AffiliationRow[] | null;
  };

  // A class's affiliation for the NRHA CSV is whichever
  // class_affiliations row belongs to an "NRHA" rule package. Classes
  // that have affiliation rows but none of them NRHA (e.g. an
  // EPRHA-only class) are excluded from the NRHA export entirely —
  // they must not leak in with a blank/wrong ClassCode. Classes with
  // no class_affiliations rows at all (not yet migrated) fall back to
  // the legacy free-text nrha_class_code field.
  const classList = ((classesRaw as unknown as ClassRow[]) ?? [])
    .map((cls) => {
      const affiliations = cls.affiliations ?? [];
      const nrhaAffiliation = affiliations.find(
        (a) => a.code?.rule_package?.association?.name?.toUpperCase() === "NRHA"
      );
      if (nrhaAffiliation) {
        return { ...cls, resolvedNrhaCode: nrhaAffiliation.code?.code ?? null };
      }
      if (affiliations.length > 0) {
        return null; // has affiliations, none of them NRHA — not an NRHA class
      }
      return { ...cls, resolvedNrhaCode: cls.nrha_class_code };
    })
    .filter((c): c is ClassRow & { resolvedNrhaCode: string | null } => c !== null);

  const classIds = classList.map((c) => c.id as string);

  if (classIds.length === 0) {
    return {
      showName: show?.name ?? "",
      csv: buildNrhaCsv([]),
      rows: [],
      readiness: checkNrhaReadiness({
        showNumber: show?.nrha_show_number ?? null,
        includedClassCount: 0,
        classesMissingCode: [],
        classesMissingPattern: [],
        entriesMissingBackNumber: [],
        entriesMissingScore: [],
        horsesMissingLicense: [],
        ridersMissingMembership: [],
      }),
      ready: false,
      includedClassCount: 0,
    };
  }

  const [
    { data: entryClasses },
    { data: scores },
    { data: results },
    { data: backNumbers },
  ] = await Promise.all([
    supabase
      .from("entry_classes")
      .select(
        "id, class_id, status, entry:entries(id, horse_id, rider_person_id, rider_name, horse_name, status)"
      )
      .in("class_id", classIds),
    supabase
      .from("scores")
      .select("entry_class_id, result_status, total_score_tenths")
      .in("class_id", classIds),
    supabase
      .from("results")
      .select("entry_class_id, placing, money_won_cents")
      .in("class_id", classIds),
    supabase.from("back_numbers").select("entry_id, number").eq("show_id", showId),
  ]);

  const ecRows =
    entryClasses?.map((ec) => ({
      id: ec.id as string,
      classId: ec.class_id as string,
      status: ec.status as "entered" | "scratched",
      entry: ec.entry as unknown as {
        id: string;
        horse_id: string;
        rider_person_id: string;
        rider_name: string;
        horse_name: string;
        status: string;
      } | null,
    })) ?? [];

  const riderIds = [...new Set(ecRows.map((ec) => ec.entry?.rider_person_id).filter(Boolean))] as string[];
  const horseIds = [...new Set(ecRows.map((ec) => ec.entry?.horse_id).filter(Boolean))] as string[];

  const [{ data: memberships }, { data: registrations }] = await Promise.all([
    riderIds.length > 0
      ? supabase
          .from("person_memberships")
          .select("person_id, membership_number")
          .eq("association", "NRHA")
          .in("person_id", riderIds)
      : Promise.resolve({ data: [] as { person_id: string; membership_number: string }[] }),
    horseIds.length > 0
      ? supabase
          .from("horse_registrations")
          .select("horse_id, registration_number, competition_license_number")
          .eq("association", "NRHA")
          .in("horse_id", horseIds)
      : Promise.resolve({
          data: [] as {
            horse_id: string;
            registration_number: string | null;
            competition_license_number: string | null;
          }[],
        }),
  ]);

  const scoreByEc = new Map(
    (scores ?? []).map((s) => [
      s.entry_class_id as string,
      s as { result_status: string; total_score_tenths: number | null },
    ])
  );
  const resultByEc = new Map(
    (results ?? []).map((r) => [
      r.entry_class_id as string,
      r as { placing: number | null; money_won_cents: number },
    ])
  );
  const backByEntry = new Map((backNumbers ?? []).map((b) => [b.entry_id as string, b.number as number]));
  const membershipByRider = new Map((memberships ?? []).map((m) => [m.person_id as string, m.membership_number as string]));
  const registrationByHorse = new Map(
    (registrations ?? []).map((r) => [
      r.horse_id as string,
      (r.competition_license_number || r.registration_number || "") as string,
    ])
  );

  const classesMissingCode: string[] = [];
  const classesMissingPattern: string[] = [];
  const entriesMissingBackNumber: string[] = [];
  const entriesMissingScore: string[] = [];
  const horsesMissingLicense: string[] = [];
  const ridersMissingMembership: string[] = [];

  const rows: NrhaCsvRow[] = [];

  for (const cls of classList) {
    const label = `Class ${cls.class_number} (${cls.name})`;
    if (!cls.resolvedNrhaCode) classesMissingCode.push(label);
    if (!cls.pattern_number) classesMissingPattern.push(label);

    const classEntryClasses = ecRows.filter((ec) => ec.classId === cls.id);
    const entryCount = classEntryClasses.length;
    // "Shown" = physically competed: scored (including DQ) but not a
    // pure no-show/excused and not scratched.
    const shownCount = classEntryClasses.filter((ec) => {
      if (ec.status === "scratched" || ec.entry?.status === "scratched") return false;
      const score = scoreByEc.get(ec.id);
      return score && ["shown", "zero", "dq"].includes(score.result_status);
    }).length;

    for (const ec of classEntryClasses) {
      const entry = ec.entry;
      if (!entry) continue;
      const riderLabel = entry.rider_name;
      const isScratched = ec.status === "scratched" || entry.status === "scratched";
      const score = scoreByEc.get(ec.id);
      const result = resultByEc.get(ec.id);
      const backNumber = backByEntry.get(entry.id);
      const memberNrha = membershipByRider.get(entry.rider_person_id) ?? "";
      const horseNrha = registrationByHorse.get(entry.horse_id) ?? "";

      if (!isScratched) {
        if (backNumber === undefined) entriesMissingBackNumber.push(`${riderLabel} (${label})`);
        if (!score) entriesMissingScore.push(`${riderLabel} (${label})`);
      }
      if (!horseNrha) horsesMissingLicense.push(`${entry.horse_name} (${riderLabel})`);
      if (!memberNrha) ridersMissingMembership.push(riderLabel);

      let totalScore: string;
      if (isScratched) {
        totalScore = "-2.0";
      } else if (!score || score.result_status === "no_score" || score.result_status === "excused") {
        totalScore = "-1.0";
      } else if (score.total_score_tenths !== null) {
        totalScore = (score.total_score_tenths / 10).toFixed(1);
      } else {
        totalScore = "-1.0";
      }

      rows.push({
        showNum: show?.nrha_show_number ?? "",
        showName: show?.name ?? "",
        className: cls.name,
        classCode: cls.resolvedNrhaCode ?? "",
        patternNum: cls.pattern_number ?? 0,
        entryCount,
        shownCount,
        goType: cls.go_type ?? "Go",
        goNum: cls.go_number ?? 1,
        horse: entry.horse_name,
        horseNrha,
        member: riderLabel,
        memberNrha,
        backNum: backNumber ?? 0,
        placeNum: result?.placing ?? 0,
        totalScore,
        moneyWon: ((result?.money_won_cents ?? 0) / 100).toFixed(2),
      });
    }
  }

  const readiness = checkNrhaReadiness({
    showNumber: show?.nrha_show_number ?? null,
    includedClassCount: classList.length,
    classesMissingCode,
    classesMissingPattern,
    entriesMissingBackNumber,
    entriesMissingScore,
    horsesMissingLicense,
    ridersMissingMembership,
  });

  return {
    showName: show?.name ?? "",
    csv: buildNrhaCsv(rows),
    rows,
    readiness,
    ready: isExportReady(readiness),
    includedClassCount: classList.length,
  };
}
