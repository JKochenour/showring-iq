import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validateEntry,
  sortBySeverity,
  type ValidationIssue,
} from "@/lib/validation-engine";
import {
  evaluateEligibilityRulesForAffiliations,
  type AffiliationEligibilityInput,
  type EligibilityRuleLike,
} from "@/lib/rule-package-engine";
import type { Entry } from "@/lib/types";

function ageAt(birthdate: string, atDate: string): number {
  const b = new Date(birthdate);
  const a = new Date(atDate);
  let age = a.getUTCFullYear() - b.getUTCFullYear();
  const m = a.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && a.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

/** Associations this show validates against. Still a static default rather
 * than derived from the show's own rule packages; NRHA is the MVP default. */
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
    supabase
      .from("shows")
      .select("start_date, organization_id")
      .eq("id", showId)
      .maybeSingle(),
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
    { data: classes },
    { data: eligibilityRules },
  ] = await Promise.all([
    supabase
      .from("entry_classes")
      .select("entry_id, class_id, status")
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
      .select("horse_id, owner_person_id")
      .in("horse_id", horseIds),
    supabase.from("people").select("id, birthdate").in("id", riderIds),
    supabase
      .from("classes")
      .select(
        `id, class_code_id,
         legacy_code:association_class_codes(code, is_youth, is_amateur, is_open, is_non_pro, rule_package_id, rule_package:association_rule_packages(association:associations(name))),
         affiliations:class_affiliations(association_class_code_id, code:association_class_codes(code, is_youth, is_amateur, is_open, is_non_pro, rule_package_id, rule_package:association_rule_packages(association:associations(name))))`
      )
      .eq("show_id", showId),
    show?.organization_id
      ? supabase
          .from("association_eligibility_rules")
          .select(
            "id, rule_key, applies_to, conditions, severity, message, rule_package_id, rule_package:association_rule_packages!inner(status)"
          )
          .eq("organization_id", show.organization_id)
          .eq("rule_package.status", "published")
      : Promise.resolve({ data: [] as never[] }),
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
  const ownerIdsByHorse = new Map<string, Set<string>>();
  for (const o of ownerships ?? []) {
    ownershipCounts.set(o.horse_id, (ownershipCounts.get(o.horse_id) ?? 0) + 1);
    const set = ownerIdsByHorse.get(o.horse_id) ?? new Set<string>();
    set.add(o.owner_person_id);
    ownerIdsByHorse.set(o.horse_id, set);
  }

  const birthdateByPerson = new Map<string, string | null>();
  for (const p of riders ?? []) birthdateByPerson.set(p.id, p.birthdate);

  type CodeRow = {
    code: string;
    is_youth: boolean;
    is_amateur: boolean;
    is_open: boolean;
    is_non_pro: boolean;
    rule_package_id: string;
    rule_package: { association: { name: string } | null } | null;
  };
  type ClassRow = {
    id: string;
    class_code_id: string | null;
    legacy_code: CodeRow | null;
    affiliations: { association_class_code_id: string; code: CodeRow | null }[] | null;
  };

  function toAffiliation(code: CodeRow): AffiliationEligibilityInput {
    return {
      rulePackageId: code.rule_package_id,
      associationName: code.rule_package?.association?.name,
      codeFlags: {
        code: code.code,
        isYouth: code.is_youth,
        isAmateur: code.is_amateur,
        isOpen: code.is_open,
        isNonPro: code.is_non_pro,
        rulePackageId: code.rule_package_id,
        associationName: code.rule_package?.association?.name,
      },
    };
  }

  const affiliationsByClass = new Map<string, AffiliationEligibilityInput[]>();
  for (const c of (classes as unknown as ClassRow[]) ?? []) {
    // class_affiliations is the source of truth once a class has rows
    // there; classes not yet migrated (or created before this
    // migration ran) fall back to the legacy single class_code_id link.
    const rows = c.affiliations ?? [];
    if (rows.length > 0) {
      const list = rows.filter((r) => r.code).map((r) => toAffiliation(r.code as CodeRow));
      if (list.length > 0) affiliationsByClass.set(c.id, list);
    } else if (c.class_code_id && c.legacy_code) {
      affiliationsByClass.set(c.id, [toAffiliation(c.legacy_code)]);
    }
  }

  const enteredAffiliationsByEntry = new Map<string, AffiliationEligibilityInput[]>();
  for (const ec of entryClasses ?? []) {
    if (ec.status !== "entered") continue;
    const affs = affiliationsByClass.get(ec.class_id);
    if (!affs) continue;
    const list = enteredAffiliationsByEntry.get(ec.entry_id) ?? [];
    list.push(...affs);
    enteredAffiliationsByEntry.set(ec.entry_id, list);
  }

  type EligibilityRuleRow = {
    id: string;
    rule_key: string;
    applies_to: string[];
    conditions: { field: string; operator: string; value: string }[];
    severity: ValidationIssue["severity"];
    message: string;
    rule_package_id: string;
  };
  const rules: EligibilityRuleLike[] = ((eligibilityRules as unknown as EligibilityRuleRow[]) ?? []).map(
    (r) => ({
      id: r.id,
      ruleKey: r.rule_key,
      appliesTo: r.applies_to ?? [],
      conditions: r.conditions ?? [],
      severity: r.severity,
      message: r.message,
      rulePackageId: r.rule_package_id,
    })
  );

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

    if (entry.status !== "scratched" && rules.length > 0) {
      const birthdate = birthdateByPerson.get(entry.rider_person_id) ?? null;
      const owners = ownerIdsByHorse.get(entry.horse_id) ?? new Set<string>();
      const ruleIssues = evaluateEligibilityRulesForAffiliations(
        rules,
        {
          rider: { age: birthdate ? ageAt(birthdate, showStartDate) : null },
          entry: {
            hasOwner: entry.owner_person_id !== null,
            ownerIsRider: entry.owner_person_id === entry.rider_person_id,
          },
          horse: {
            ownershipCount: ownershipCounts.get(entry.horse_id) ?? 0,
            ownedByRider: owners.has(entry.rider_person_id),
          },
        },
        enteredAffiliationsByEntry.get(entry.id) ?? []
      );
      issues.push(...ruleIssues);
      sortBySeverity(issues);
    }

    return { entry, backNumber, enteredClassCount, issues };
  });

  return { showStartDate, entries: validated };
}
