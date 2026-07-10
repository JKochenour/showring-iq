import { PERSON_ROLES, MEMBERSHIP_STATUS_OPTIONS } from "@/lib/validation/person";
import { HORSE_SEXES } from "@/lib/validation/horse";

/** Splits a free-text roles cell ("Rider, Owner") into canonical role values. */
export function normalizeRoles(raw: string | undefined): {
  roles: string[];
  unrecognized: string[];
} {
  if (!raw || !raw.trim()) return { roles: ["rider"], unrecognized: [] };
  const tokens = raw
    .split(/[,;/]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const roles: string[] = [];
  const unrecognized: string[] = [];
  for (const token of tokens) {
    const lower = token.toLowerCase();
    const found = PERSON_ROLES.find(
      (r) => r.value === lower || r.label.toLowerCase() === lower || r.value.replace("_", " ") === lower
    );
    if (found) {
      if (!roles.includes(found.value)) roles.push(found.value);
    } else {
      unrecognized.push(token);
    }
  }
  return roles.length > 0 ? { roles, unrecognized } : { roles: ["rider"], unrecognized };
}

export function normalizeSex(raw: string | undefined): string | undefined {
  if (!raw || !raw.trim()) return undefined;
  const lower = raw.trim().toLowerCase();
  const found = HORSE_SEXES.find(
    (s) => s.value === lower || s.label.toLowerCase() === lower || s.value[0] === lower
  );
  return found?.value;
}

export function normalizeStatus(raw: string | undefined): string {
  if (!raw || !raw.trim()) return "unknown";
  const lower = raw.trim().toLowerCase();
  const found = MEMBERSHIP_STATUS_OPTIONS.find(
    (s) => s.value === lower || s.label.toLowerCase() === lower
  );
  return found?.value ?? "unknown";
}

/** Best-effort date parse (ISO, M/D/YYYY, M-D-YYYY) -> "YYYY-MM-DD", or undefined if unparseable. */
export function normalizeDate(raw: string | undefined): string | undefined {
  if (!raw || !raw.trim()) return undefined;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const [, mo, da, yr] = m;
    return `${yr}-${mo.padStart(2, "0")}-${da.padStart(2, "0")}`;
  }
  return undefined;
}

/** Best-effort 4-digit year extraction, e.g. from a full birthdate cell. */
export function normalizeYear(raw: string | undefined): string | undefined {
  if (!raw || !raw.trim()) return undefined;
  const m = raw.match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : raw.trim();
}
