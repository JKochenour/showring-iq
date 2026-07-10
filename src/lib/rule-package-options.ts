import type { SupabaseClient } from "@supabase/supabase-js";
import type { ComboboxOption } from "@/components/combobox";

/** Class codes from every non-archived rule package in the org, for the class-form picker. */
export async function getClassCodeOptions(
  supabase: SupabaseClient,
  organizationId: string
): Promise<ComboboxOption[]> {
  const { data } = await supabase
    .from("association_class_codes")
    .select(
      "id, code, name, active, rule_package:association_rule_packages(year, version, status, association:associations(name))"
    )
    .eq("organization_id", organizationId)
    .eq("active", true)
    .order("code");

  type Row = {
    id: string;
    code: string;
    name: string;
    rule_package: {
      year: number;
      version: string;
      status: string;
      association: { name: string } | null;
    } | null;
  };

  return ((data as unknown as Row[]) ?? [])
    .filter((row) => row.rule_package?.status !== "archived")
    .map((row) => {
      const pkg = row.rule_package;
      const pkgLabel = pkg
        ? `${pkg.association?.name ?? "?"} ${pkg.year}·v${pkg.version} — ${pkg.status}`
        : "no package";
      return {
        id: row.id,
        label: `${row.code} — ${row.name} (${pkgLabel})`,
      };
    });
}
