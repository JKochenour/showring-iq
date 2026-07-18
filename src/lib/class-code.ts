import type { SupabaseClient } from "@supabase/supabase-js";

/** The shape of the class_affiliations -> association_class_codes join
 * used wherever a class needs to be identified by its association code.
 * Select it as:
 *   affiliations:class_affiliations(code:association_class_codes(code, name,
 *     rule_package:association_rule_packages(association:associations(name))))
 */
export type ClassCodeAffiliation = {
  code: {
    code: string;
    name: string;
    rule_package: { association: { name: string } | null } | null;
  } | null;
};

export type ResolvedClassCode = {
  code: string;
  /** The association's own name for the code, when the class is linked to
   * a real code. Null when falling back to the legacy free-text field. */
  name: string | null;
};

/**
 * The NRHA code a class will be filed under.
 *
 * Resolved in the same order the ReinerSuite export resolves it, so a
 * score sheet, the class list, and the submitted CSV can never disagree:
 * a linked NRHA affiliation first, then the legacy free-text
 * classes.nrha_class_code, then nothing.
 */
export function resolveNrhaCode(cls: {
  nrha_class_code?: string | null;
  affiliations?: ClassCodeAffiliation[] | null;
}): ResolvedClassCode | null {
  const linked = (cls.affiliations ?? []).find(
    (a) => a.code?.rule_package?.association?.name?.toUpperCase() === "NRHA"
  )?.code;
  if (linked) return { code: linked.code, name: linked.name };
  if (cls.nrha_class_code) return { code: cls.nrha_class_code, name: null };
  return null;
}

/**
 * How a class code reads for a given slate of a weekend.
 *
 * A weekend runs the same class list as two separately-judged,
 * separately-paid go's. The second go of a class is written "5300 (2)".
 * A standalone show, or the first slate, is just the bare code.
 */
export function formatClassCode(code: string, slateNumber: number): string {
  return slateNumber > 1 ? `${code} (${slateNumber})` : code;
}

/**
 * Which slate of its weekend this show is: 1 for the first (or for a
 * standalone show), 2 for the second, and so on. Ordered by start date,
 * matching how the slates are presented everywhere else.
 */
export async function loadSlateNumber(
  supabase: SupabaseClient,
  show: { id: string; weekend_id: string | null }
): Promise<number> {
  if (!show.weekend_id) return 1;
  const { data } = await supabase
    .from("shows")
    .select("id, start_date")
    .eq("weekend_id", show.weekend_id)
    .order("start_date", { ascending: true })
    .order("id", { ascending: true });
  const slates = data ?? [];
  if (slates.length < 2) return 1;
  const index = slates.findIndex((s) => s.id === show.id);
  return index >= 0 ? index + 1 : 1;
}
