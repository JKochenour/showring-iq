import type { SupabaseClient } from "@supabase/supabase-js";

/** IRS 1099-NEC reporting threshold. Informational flag only — this
 * app never files or generates the form itself. */
export const FORM_1099_THRESHOLD_CENTS = 600_00;

export interface PayeeReportRow {
  personId: string;
  name: string;
  taxName: string | null;
  moneyWonCents: number;
  hasVerifiedW9: boolean;
  showCount: number;
}

/** Year-end payout totals per payee (owner of record, falling back to
 * rider — matches the "owners of record" convention CLAUDE.md already
 * documents for NRHA Top Ten awards), across every show in the org for
 * a calendar year. A prep aid for 1099-NEC, not a filer. */
export async function loadPayeeReport(
  supabase: SupabaseClient,
  organizationId: string,
  year: number
): Promise<PayeeReportRow[]> {
  const { data: shows } = await supabase
    .from("shows")
    .select("id")
    .eq("organization_id", organizationId)
    .gte("start_date", `${year}-01-01`)
    .lte("start_date", `${year}-12-31`);
  const showIds = (shows ?? []).map((s) => s.id as string);
  if (showIds.length === 0) return [];

  const { data: results } = await supabase
    .from("results")
    .select("entry_class_id, show_id, money_won_cents")
    .in("show_id", showIds)
    .gt("money_won_cents", 0);
  if (!results || results.length === 0) return [];

  const { data: entryClasses } = await supabase
    .from("entry_classes")
    .select("id, entry_id")
    .in(
      "id",
      results.map((r) => r.entry_class_id as string)
    );
  const entryIdByEntryClass = new Map(
    (entryClasses ?? []).map((ec) => [ec.id as string, ec.entry_id as string])
  );

  const { data: entries } = await supabase
    .from("entries")
    .select("id, owner_person_id, rider_person_id, owner_name, rider_name")
    .in("id", [...new Set([...entryIdByEntryClass.values()])]);
  const entryById = new Map((entries ?? []).map((e) => [e.id as string, e]));

  const buckets = new Map<
    string,
    { name: string; moneyWonCents: number; shows: Set<string> }
  >();

  for (const r of results) {
    const entryId = entryIdByEntryClass.get(r.entry_class_id as string);
    const entry = entryId ? entryById.get(entryId) : null;
    if (!entry) continue;

    const personId = (entry.owner_person_id as string | null) ?? (entry.rider_person_id as string);
    const name =
      (entry.owner_person_id
        ? (entry.owner_name as string | null)
        : (entry.rider_name as string)) ?? "Unknown";

    const bucket = buckets.get(personId) ?? {
      name,
      moneyWonCents: 0,
      shows: new Set<string>(),
    };
    bucket.moneyWonCents += (r.money_won_cents as number) ?? 0;
    bucket.shows.add(r.show_id as string);
    buckets.set(personId, bucket);
  }

  if (buckets.size === 0) return [];

  const personIds = [...buckets.keys()];
  const [{ data: people }, { data: w9Docs }] = await Promise.all([
    supabase.from("people").select("id, tax_name").in("id", personIds),
    supabase
      .from("documents")
      .select("person_id")
      .in("person_id", personIds)
      .eq("document_type", "w9")
      .eq("status", "verified"),
  ]);
  const taxNameByPerson = new Map(
    (people ?? []).map((p) => [p.id as string, p.tax_name as string | null])
  );
  const verifiedW9 = new Set((w9Docs ?? []).map((d) => d.person_id as string));

  return [...buckets.entries()]
    .map(([personId, b]) => ({
      personId,
      name: b.name,
      taxName: taxNameByPerson.get(personId) ?? null,
      moneyWonCents: b.moneyWonCents,
      hasVerifiedW9: verifiedW9.has(personId),
      showCount: b.shows.size,
    }))
    .sort((a, b) => b.moneyWonCents - a.moneyWonCents);
}
