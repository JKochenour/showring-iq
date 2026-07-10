import type { SupabaseClient } from "@supabase/supabase-js";

export interface MissingPaperworkSummary {
  ridersWithNoDocs: number;
  horsesWithNoDocs: number;
  pendingCount: number;
  expiredCount: number;
}

const CLEAR: MissingPaperworkSummary = {
  ridersWithNoDocs: 0,
  horsesWithNoDocs: 0,
  pendingCount: 0,
  expiredCount: 0,
};

/** Summarizes paperwork status for a show's active entries: entries whose
 * rider/horse has no verified document on file at all, documents awaiting
 * verification, and verified documents past their expiration date. Read
 * counterpart to the NRHA export package's verified-document pull in
 * exports/nrha-package/route.tsx. */
export async function loadMissingPaperworkSummary(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  showId: string
): Promise<MissingPaperworkSummary> {
  const { data: entries } = await supabase
    .from("entries")
    .select("rider_person_id, horse_id")
    .eq("show_id", showId)
    .eq("status", "active");

  const entryRows = entries ?? [];
  if (entryRows.length === 0) return CLEAR;

  const riderIds = [...new Set(entryRows.map((e) => e.rider_person_id as string))];
  const horseIds = [...new Set(entryRows.map((e) => e.horse_id as string))];

  const [{ data: riderDocs }, { data: horseDocs }] = await Promise.all([
    riderIds.length > 0
      ? supabase
          .from("documents")
          .select("id, person_id, horse_id, status, expiration_date")
          .in("person_id", riderIds)
      : Promise.resolve({ data: [] as never[] }),
    horseIds.length > 0
      ? supabase
          .from("documents")
          .select("id, person_id, horse_id, status, expiration_date")
          .in("horse_id", horseIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  type Doc = {
    id: string;
    person_id: string | null;
    horse_id: string | null;
    status: string;
    expiration_date: string | null;
  };
  const allDocs = [...((riderDocs ?? []) as Doc[]), ...((horseDocs ?? []) as Doc[])];
  const uniqueDocs = [...new Map(allDocs.map((d) => [d.id, d])).values()];

  const verifiedPersonIds = new Set<string>();
  const verifiedHorseIds = new Set<string>();
  let pendingCount = 0;
  let expiredCount = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const doc of uniqueDocs) {
    if (doc.status === "verified") {
      if (doc.person_id) verifiedPersonIds.add(doc.person_id);
      if (doc.horse_id) verifiedHorseIds.add(doc.horse_id);
      if (doc.expiration_date && doc.expiration_date < today) expiredCount++;
    } else if (doc.status === "pending") {
      pendingCount++;
    }
  }

  const ridersWithNoDocs = entryRows.filter(
    (e) => !verifiedPersonIds.has(e.rider_person_id as string)
  ).length;
  const horsesWithNoDocs = entryRows.filter(
    (e) => !verifiedHorseIds.has(e.horse_id as string)
  ).length;

  return { ridersWithNoDocs, horsesWithNoDocs, pendingCount, expiredCount };
}
