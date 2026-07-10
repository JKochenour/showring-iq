import type { SupabaseClient } from "@supabase/supabase-js";

export interface ShowResultsClass {
  classId: string;
  classNumber: number;
  name: string;
  discipline: string | null;
  patternNumber: number | null;
  rows: {
    placing: number | null;
    tieStatus: "none" | "tied";
    backNumber: number | null;
    riderName: string;
    horseName: string;
    ownerName: string | null;
    scoreLabel: string;
    scratched: boolean;
  }[];
}

export interface ShowResultsData {
  showName: string;
  showNumber: string | null;
  startDate: string;
  endDate: string;
  classes: ShowResultsClass[];
  /** Informational only — does not drive money_won on any export.
   * Full payout formulas (added money split by placement, category
   * exceptions, tie splits) are future work; this is a fee tally. */
  totalEntryFeeCents: number;
  retainageCents: number;
  medicationFeeCents: number;
  activeEntryCount: number;
  medicationFeeTotalCents: number;
}

const INCLUDED_STATUSES = ["official", "results_posted", "exported"];

export async function loadShowResults(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  showId: string
): Promise<ShowResultsData> {
  const { data: show } = await supabase
    .from("shows")
    .select("name, nrha_show_number, start_date, end_date, medication_fee_cents")
    .eq("id", showId)
    .maybeSingle();

  const { count: activeEntryCount } = await supabase
    .from("entries")
    .select("id", { count: "exact", head: true })
    .eq("show_id", showId)
    .eq("status", "active");

  const { data: classes } = await supabase
    .from("classes")
    .select("id, class_number, name, discipline, pattern_number, status")
    .eq("show_id", showId)
    .in("status", INCLUDED_STATUSES)
    .order("display_order");

  const classList = classes ?? [];
  const classIds = classList.map((c) => c.id as string);

  const medicationFeeCents = (show?.medication_fee_cents as number) ?? 0;
  const entryCount = activeEntryCount ?? 0;

  if (classIds.length === 0) {
    return {
      showName: show?.name ?? "",
      showNumber: show?.nrha_show_number ?? null,
      startDate: show?.start_date ?? "",
      endDate: show?.end_date ?? "",
      classes: [],
      totalEntryFeeCents: 0,
      retainageCents: 0,
      medicationFeeCents,
      activeEntryCount: entryCount,
      medicationFeeTotalCents: medicationFeeCents * entryCount,
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
        "id, class_id, status, fee_cents, entry:entries(id, rider_name, horse_name, owner_name, status)"
      )
      .in("class_id", classIds),
    supabase
      .from("scores")
      .select("entry_class_id, result_status, total_score_tenths")
      .in("class_id", classIds),
    supabase.from("results").select("entry_class_id, placing, tie_status").in("class_id", classIds),
    supabase.from("back_numbers").select("entry_id, number").eq("show_id", showId),
  ]);

  const scoreByEc = new Map(
    (scores ?? []).map((s) => [s.entry_class_id as string, s])
  );
  const resultByEc = new Map(
    (results ?? []).map((r) => [r.entry_class_id as string, r])
  );
  const backByEntry = new Map(
    (backNumbers ?? []).map((b) => [b.entry_id as string, b.number as number])
  );

  let totalEntryFeeCents = 0;

  const resultClasses: ShowResultsClass[] = classList.map((cls) => {
    const classEcs = (entryClasses ?? []).filter((ec) => ec.class_id === cls.id);

    const rows = classEcs.map((ec) => {
      const entry = ec.entry as unknown as {
        id: string;
        rider_name: string;
        horse_name: string;
        owner_name: string | null;
        status: string;
      } | null;
      const scratched = ec.status === "scratched" || entry?.status === "scratched";
      const score = scoreByEc.get(ec.id as string) as
        | { result_status: string; total_score_tenths: number | null }
        | undefined;
      const result = resultByEc.get(ec.id as string) as
        | { placing: number | null; tie_status: string }
        | undefined;

      if (!scratched) totalEntryFeeCents += ec.fee_cents as number;

      let scoreLabel = "—";
      if (scratched) scoreLabel = "Scratched";
      else if (score?.result_status === "shown" || score?.result_status === "zero") {
        scoreLabel = ((score.total_score_tenths ?? 0) / 10).toFixed(1);
      } else if (score) {
        scoreLabel = score.result_status.replace("_", " ");
      }

      return {
        placing: result?.placing ?? null,
        tieStatus: (result?.tie_status as "none" | "tied") ?? "none",
        backNumber: entry ? (backByEntry.get(entry.id) ?? null) : null,
        riderName: entry?.rider_name ?? "Unknown",
        horseName: entry?.horse_name ?? "Unknown",
        ownerName: entry?.owner_name ?? null,
        scoreLabel,
        scratched,
      };
    });

    rows.sort((a, b) => {
      const ap = a.placing ?? 9999;
      const bp = b.placing ?? 9999;
      return ap - bp;
    });

    return {
      classId: cls.id as string,
      classNumber: cls.class_number as number,
      name: cls.name as string,
      discipline: cls.discipline as string | null,
      patternNumber: cls.pattern_number as number | null,
      rows,
    };
  });

  return {
    showName: show?.name ?? "",
    showNumber: show?.nrha_show_number ?? null,
    startDate: show?.start_date ?? "",
    endDate: show?.end_date ?? "",
    classes: resultClasses,
    totalEntryFeeCents,
    retainageCents: Math.round(totalEntryFeeCents * 0.05),
    medicationFeeCents,
    activeEntryCount: entryCount,
    medicationFeeTotalCents: medicationFeeCents * entryCount,
  };
}
