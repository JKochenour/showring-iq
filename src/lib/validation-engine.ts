/**
 * Entry validation engine.
 *
 * Rules are data (code/severity/message + a predicate), not scattered
 * business logic — when association rule packages arrive, they will supply
 * rule sets like these per affiliation instead of this built-in default.
 *
 * Severity ladder (per CLAUDE.md): info < warning < blocking < critical.
 * Check-in treats blocking+ as requiring an override reason; exports will
 * refuse to generate on blocking+.
 */

export type Severity = "info" | "warning" | "blocking" | "critical";

export interface ValidationIssue {
  code: string;
  severity: Severity;
  message: string;
}

export interface MembershipLike {
  association: string;
  membership_number: string;
  status: string;
  expiration_date: string | null;
}

export interface RegistrationLike {
  association: string;
  registration_number: string | null;
  competition_license_number: string | null;
  status: string;
  expiration_date: string | null;
}

export interface EntryValidationContext {
  showStartDate: string; // ISO date
  entryStatus: "active" | "scratched";
  enteredClassCount: number;
  backNumber: number | null;
  hasOwner: boolean;
  riderBirthdate: string | null;
  riderMemberships: MembershipLike[];
  horseRegistrations: RegistrationLike[];
  horseOwnershipCount: number;
  /** Associations the show requires (from rule packages later). */
  requiredAssociations: string[];
}

interface ValidationRule {
  code: string;
  severity: Severity;
  /** Returns issue message(s) when the rule fails; empty array when it passes. */
  check: (ctx: EntryValidationContext) => string[];
}

const RULES: ValidationRule[] = [
  {
    code: "no_entered_classes",
    severity: "warning",
    check: (ctx) =>
      ctx.enteredClassCount === 0
        ? ["Entry has no entered classes (none added, or all scratched)."]
        : [],
  },
  {
    code: "no_back_number",
    severity: "blocking",
    check: (ctx) =>
      ctx.backNumber === null ? ["No back number assigned."] : [],
  },
  {
    code: "rider_missing_membership",
    severity: "warning",
    check: (ctx) =>
      ctx.requiredAssociations
        .filter(
          (assoc) =>
            !ctx.riderMemberships.some((m) => m.association === assoc)
        )
        .map((assoc) => `Rider has no ${assoc} membership number on file.`),
  },
  {
    code: "rider_membership_expired",
    severity: "warning",
    check: (ctx) =>
      ctx.riderMemberships
        .filter(
          (m) =>
            ctx.requiredAssociations.includes(m.association) &&
            ((m.expiration_date && m.expiration_date < ctx.showStartDate) ||
              m.status === "expired")
        )
        .map(
          (m) =>
            `Rider's ${m.association} membership #${m.membership_number} is expired${
              m.expiration_date ? ` (${m.expiration_date})` : ""
            }.`
        ),
  },
  {
    code: "horse_missing_registration",
    severity: "warning",
    check: (ctx) =>
      ctx.requiredAssociations
        .filter(
          (assoc) =>
            !ctx.horseRegistrations.some((r) => r.association === assoc)
        )
        .map(
          (assoc) =>
            `Horse has no ${assoc} registration or competition license on file.`
        ),
  },
  {
    code: "horse_registration_expired",
    severity: "warning",
    check: (ctx) =>
      ctx.horseRegistrations
        .filter(
          (r) =>
            ctx.requiredAssociations.includes(r.association) &&
            ((r.expiration_date && r.expiration_date < ctx.showStartDate) ||
              r.status === "expired")
        )
        .map((r) => `Horse's ${r.association} registration is expired.`),
  },
  {
    code: "no_owner_on_entry",
    severity: "info",
    check: (ctx) => (!ctx.hasOwner ? ["Entry has no owner selected."] : []),
  },
  {
    code: "horse_no_ownership_records",
    severity: "info",
    check: (ctx) =>
      ctx.horseOwnershipCount === 0
        ? ["Horse has no ownership records — ownership checks can't run."]
        : [],
  },
  {
    code: "rider_missing_birthdate",
    severity: "info",
    check: (ctx) =>
      ctx.riderBirthdate === null
        ? ["Rider birthdate missing — youth/age checks can't run."]
        : [],
  },
];

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  blocking: 1,
  warning: 2,
  info: 3,
};

export function sortBySeverity(issues: ValidationIssue[]): ValidationIssue[] {
  return issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

export function validateEntry(ctx: EntryValidationContext): ValidationIssue[] {
  if (ctx.entryStatus === "scratched") return [];
  const issues: ValidationIssue[] = [];
  for (const rule of RULES) {
    for (const message of rule.check(ctx)) {
      issues.push({ code: rule.code, severity: rule.severity, message });
    }
  }
  return sortBySeverity(issues);
}

export function hasBlockingIssues(issues: ValidationIssue[]): boolean {
  return issues.some(
    (issue) => issue.severity === "blocking" || issue.severity === "critical"
  );
}

/** Standard disclaimer — never claim guarantees (legal constraint). */
export const VALIDATION_DISCLAIMER =
  "Validation assistance based on configured rule package. Final responsibility remains with show management and the applicable association.";
