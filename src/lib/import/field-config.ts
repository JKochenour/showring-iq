export type ImportFieldConfig = {
  key: string;
  label: string;
  required?: boolean;
  synonyms: string[];
};

export const PEOPLE_IMPORT_FIELDS: ImportFieldConfig[] = [
  { key: "firstName", label: "First name", required: true, synonyms: ["first name", "first", "fname", "given name"] },
  { key: "lastName", label: "Last name", required: true, synonyms: ["last name", "last", "lname", "surname", "family name"] },
  { key: "preferredName", label: "Preferred name", synonyms: ["preferred name", "nickname", "goes by"] },
  { key: "email", label: "Email", synonyms: ["email", "e-mail", "email address"] },
  { key: "phone", label: "Phone", synonyms: ["phone", "phone number", "cell", "mobile"] },
  { key: "city", label: "City", synonyms: ["city"] },
  { key: "state", label: "State", synonyms: ["state", "st"] },
  { key: "birthdate", label: "Birthdate", synonyms: ["birthdate", "birth date", "dob", "date of birth"] },
  { key: "roles", label: "Roles", synonyms: ["role", "roles", "type"] },
  { key: "membershipAssociation", label: "Membership association", synonyms: ["association", "membership association", "org"] },
  { key: "membershipNumber", label: "Membership number", synonyms: ["membership number", "member number", "member #", "membership #", "nrha number", "nrha #"] },
  { key: "membershipStatus", label: "Membership status", synonyms: ["membership status", "status"] },
  { key: "notes", label: "Notes", synonyms: ["notes", "comment", "comments"] },
];

export const HORSE_IMPORT_FIELDS: ImportFieldConfig[] = [
  { key: "registeredName", label: "Registered name", required: true, synonyms: ["registered name", "horse name", "name"] },
  { key: "barnName", label: "Barn name", synonyms: ["barn name", "call name", "nickname"] },
  { key: "breed", label: "Breed", synonyms: ["breed"] },
  { key: "sex", label: "Sex", synonyms: ["sex", "gender"] },
  { key: "color", label: "Color", synonyms: ["color", "colour"] },
  { key: "foalYear", label: "Foal year", synonyms: ["foal year", "foal date", "year foaled", "birth year", "dob"] },
  { key: "sire", label: "Sire", synonyms: ["sire"] },
  { key: "dam", label: "Dam", synonyms: ["dam"] },
  { key: "ownerName", label: "Owner name", synonyms: ["owner", "owner name"] },
  { key: "ownerPercentage", label: "Ownership %", synonyms: ["ownership percent", "ownership percentage", "owner percent", "owner percentage", "percentage", "percent owned", "pct owned"] },
  { key: "registrationAssociation", label: "Registration association", synonyms: ["association", "registration association"] },
  { key: "registrationNumber", label: "Registration number", synonyms: ["registration number", "reg number", "reg #", "nrha number", "aqha number", "mem no", "member no", "member number", "memno"] },
  { key: "competitionLicenseNumber", label: "Competition license #", synonyms: ["competition license", "license number", "license #", "license"] },
  { key: "registrationStatus", label: "Registration status", synonyms: ["registration status", "status"] },
  { key: "notes", label: "Notes", synonyms: ["notes", "comment", "comments"] },
];

/**
 * Lowercased, letters-and-digits-only form — makes "HorseName" and "Horse
 * Name" compare equal. "%" is spelled out first (not just stripped) so
 * "Ownership %" stays distinct from "Ownership" instead of collapsing into
 * a generic substring that could match unrelated columns.
 */
function compact(s: string): string {
  return s
    .toLowerCase()
    .replace(/%/g, "percent")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Best-effort column -> field auto-mapping by normalized header text.
 *
 * Runs as two global passes across all fields, not one pass per field: an
 * exact-match pass first (on both space-normalized and compact forms, so
 * spreadsheet exports with no-space headers like "HorseName" or "MemNo"
 * still match multi-word synonyms), then a substring-match pass. Substring
 * matching only considers synonyms of 4+ characters, so a short synonym
 * like state's "st" can't falsely match inside an unrelated header like
 * "Membership Status" before that field gets a chance to claim its own
 * exact match.
 */
export function guessMapping(
  headers: string[],
  fields: ImportFieldConfig[]
): Record<string, number | null> {
  const normalized = headers.map((h) => h.trim().toLowerCase().replace(/\s+/g, " "));
  const compactHeaders = headers.map((h) => compact(h));
  const mapping: Record<string, number | null> = {};
  const usedColumns = new Set<number>();
  for (const field of fields) mapping[field.key] = null;

  for (const field of fields) {
    for (const syn of field.synonyms) {
      const synCompact = compact(syn);
      const idx = normalized.findIndex(
        (h, i) => !usedColumns.has(i) && (h === syn || compactHeaders[i] === synCompact)
      );
      if (idx !== -1) {
        mapping[field.key] = idx;
        usedColumns.add(idx);
        break;
      }
    }
  }

  for (const field of fields) {
    if (mapping[field.key] !== null) continue;
    for (const syn of field.synonyms) {
      if (syn.length < 4) continue;
      const synCompact = compact(syn);
      const idx = normalized.findIndex(
        (h, i) => !usedColumns.has(i) && (h.includes(syn) || compactHeaders[i].includes(synCompact))
      );
      if (idx !== -1) {
        mapping[field.key] = idx;
        usedColumns.add(idx);
        break;
      }
    }
  }

  return mapping;
}
