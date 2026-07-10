import type { SupabaseClient } from "@supabase/supabase-js";

export interface DrawRunRow {
  id: string;
  position: number;
  run_status: string;
  entry_class_id: string;
  entryClassStatus: "entered" | "scratched";
  entryId: string | null;
  entryNumber: number | null;
  riderName: string;
  horseName: string;
  ownerName: string | null;
  trainerName: string | null;
  checkedInAt: string | null;
  backNumber: number | null;
}

/** Draw rows for a class in running order, joined with entry display data. */
export async function loadClassDraw(
  supabase: SupabaseClient,
  showId: string,
  classId: string
): Promise<DrawRunRow[]> {
  const [{ data: rows }, { data: backNumbers }] = await Promise.all([
    supabase
      .from("class_draws")
      .select(
        "id, position, run_status, entry_class_id, entry_class:entry_classes(id, status, entry:entries(id, entry_number, rider_name, horse_name, owner_name, trainer_name, checked_in_at))"
      )
      .eq("class_id", classId)
      .order("position"),
    supabase.from("back_numbers").select("entry_id, number").eq("show_id", showId),
  ]);

  const backByEntry = new Map<string, number>();
  for (const bn of backNumbers ?? []) backByEntry.set(bn.entry_id, bn.number);

  return (rows ?? []).map((row) => {
    const entryClass = row.entry_class as unknown as {
      id: string;
      status: "entered" | "scratched";
      entry: {
        id: string;
        entry_number: number;
        rider_name: string;
        horse_name: string;
        owner_name: string | null;
        trainer_name: string | null;
        checked_in_at: string | null;
      } | null;
    } | null;
    const entry = entryClass?.entry ?? null;
    return {
      id: row.id as string,
      position: row.position as number,
      run_status: row.run_status as string,
      entry_class_id: row.entry_class_id as string,
      entryClassStatus: entryClass?.status ?? "entered",
      entryId: entry?.id ?? null,
      entryNumber: entry?.entry_number ?? null,
      riderName: entry?.rider_name ?? "Unknown",
      horseName: entry?.horse_name ?? "Unknown",
      ownerName: entry?.owner_name ?? null,
      trainerName: entry?.trainer_name ?? null,
      checkedInAt: entry?.checked_in_at ?? null,
      backNumber: entry ? (backByEntry.get(entry.id) ?? null) : null,
    };
  });
}
