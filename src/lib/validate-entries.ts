import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validateEntry,
  type ValidationIssue,
} from "@/lib/validation-engine";
import type { Entry } from "@/lib/types";

/** Associations this show validates against. Comes from the show's rule
 * packages in a later sprint; NRHA is the MVP default. */
const DEFAULT_REQUIRED_ASSOCIATIONS = ["NRHA"];

export interface ValidatedEntry {
  entry: Entry;
  backNumber: number | null;
  enteredClassCount: number;
  issues: ValidationIssue[];
}

/** Loads every entry for a show with its validation issues, in batched
 * queries (no per-entry round trips). */
export async function loadValidatedEntries(
  supabase: SupabaseClient,
  showId: string
): Promise<{ showStartDate: string; entries: ValidatedEntry[] }> {
  const [{ data: show }, { data: entries }] = await Promise.all([
    supabase.from("shows").select("start_date").eq("id", showId).maybeSingle(),
    supabase
      .from("entries")
      .select("*")
      .eq("show_id", showId)
      .order("entry_number"),
  ]);

  const entryRows = (entries as Entry[]) ?? [];
  const showStartDate = (show?.start_date as string) ?? "1970-01-01";
  if (entryRows.length === 0) return { showStartDate, entries: [] };

  const riderIds = [...new Set(entryRows.map((e) => e.rider_person_id))];
  const horseIds = [...new Set(entryRows.map((e) => e.horse_id))];

  const [
    { data: entryClasses },
    { data: backNumbers },
    { data: memberships },
    { data: registrations },
    { data: ownerships },
    { data: riders },
  ] = await Promise.all([
    supabase
      .from("entry_classes")
      .select("entry_id, status")
      .eq("show_id", showId),
    supabase.from("back_numbers").select("entry_id, number").eq("show_id", showId),
    supabase
      .from("person_memberships")
      .select("person_id, association, membership_number, status, expiration_date")
      .in("person_id", riderIds),
    supabase
      .from("horse_registrations")
      .select(
        "horse_id, association, registration_number, competition_license_number, status, expiration_date"
      )
      .in("horse_id", horseIds),
    supabase
      .from("horse_ownerships")
      .select("horse_id")
      .in("horse_id", horseIds),
    supabase.from("people").select("id, birthdate").in("id", riderIds),
  ]);

  const enteredCounts = new Map<string, number>();
  for (const ec of entryClasses ?? []) {
    if (ec.status === "entered") {
      enteredCounts.set(ec.entry_id, (enteredCounts.get(ec.entry_id) ?? 0) + 1);
    } else {
      enteredCounts.set(ec.entry_id, enteredCounts.get(ec.entry_id) ?? 0);
    }
  }

  const backByEntry = new Map<string, number>();
  for (const bn of backNumbers ?? []) backByEntry.set(bn.entry_id, bn.number);

  const membershipsByPerson = new Map<string, NonNullable<typeof memberships>>();
  for (const m of memberships ?? []) {
    const list = membershipsByPerson.get(m.person_id) ?? [];
    list.push(m);
    membershipsByPerson.set(m.person_id, list);
  }

  const registrationsByHorse = new Map<string, NonNullable<typeof registrations>>();
  for (const r of registrations ?? []) {
    const list = registrationsByHorse.get(r.horse_id) ?? [];
    list.push(r);
    registrationsByHorse.set(r.horse_id, list);
  }

  const ownershipCounts = new Map<string, number>();
  for (const o of ownerships ?? []) {
    ownershipCounts.set(o.horse_id, (ownershipCounts.get(o.horse_id) ?? 0) + 1);
  }

  const birthdateByPerson = new Map<string, string | null>();
  for (const p of riders ?? []) birthdateByPerson.set(p.id, p.birthdate);

  const validated = entryRows.map((entry) => {
    const backNumber = backByEntry.get(entry.id) ?? null;
    const enteredClassCount = enteredCounts.get(entry.id) ?? 0;
    const issues = validateEntry({
      showStartDate,
      entryStatus: entry.status,
      enteredClassCount,
      backNumber,
      hasOwner: entry.owner_person_id !== null,
      riderBirthdate: birthdateByPerson.get(entry.rider_person_id) ?? null,
      riderMemberships: membershipsByPerson.get(entry.rider_person_id) ?? [],
      horseRegistrations: registrationsByHorse.get(entry.horse_id) ?? [],
      horseOwnershipCount: ownershipCounts.get(entry.horse_id) ?? 0,
      requiredAssociations: DEFAULT_REQUIRED_ASSOCIATIONS,
    });
    return { entry, backNumber, enteredClassCount, issues };
  });

  return { showStartDate, entries: validated };
}
