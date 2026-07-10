/**
 * Generic evaluator for `association_eligibility_rules.conditions` — turns
 * a rule package's data-driven eligibility rules into ValidationIssues,
 * instead of hard-coding association logic (CLAUDE.md: "Association rules
 * are DATA, not code").
 *
 * Supported context fields a rule's `field` can reference:
 *   rider.age              (number | null — computed from birthdate at show start)
 *   entry.hasOwner          (boolean)
 *   entry.ownerIsRider      (boolean)
 *   horse.ownershipCount    (number)
 *   horse.ownedByRider      (boolean — rider is a listed owner of the horse)
 *
 * `conditions` are AND'd together and describe what must be TRUE for the
 * entry to be compliant — when any condition fails, the rule's configured
 * severity + message becomes an issue (mirrors the CLAUDE.md example:
 * "✕ Non Pro Derby — missing ownership relationship").
 *
 * `applies_to` scopes which entries a rule runs against: empty = every
 * entry in the show; otherwise it's matched against each entered class's
 * linked rule-package code, by exact code string ("5300") or by category
 * flag alias ("non_pro", "youth", "amateur", "open").
 */

import type { Severity, ValidationIssue } from "@/lib/validation-engine";

export interface RuleEngineContext {
  rider: { age: number | null };
  entry: { hasOwner: boolean; ownerIsRider: boolean };
  horse: { ownershipCount: number; ownedByRider: boolean };
}

export interface ClassCodeFlags {
  code: string;
  isYouth: boolean;
  isAmateur: boolean;
  isOpen: boolean;
  isNonPro: boolean;
}

export interface EligibilityRuleLike {
  id: string;
  ruleKey: string;
  appliesTo: string[];
  conditions: { field: string; operator: string; value: string }[];
  severity: Severity;
  message: string;
}

const FLAG_ALIASES: Record<string, keyof Omit<ClassCodeFlags, "code">> = {
  youth: "isYouth",
  amateur: "isAmateur",
  open: "isOpen",
  nonpro: "isNonPro",
  "non-pro": "isNonPro",
  non_pro: "isNonPro",
};

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

/** True if a rule scoped by `appliesTo` should run for an entry given its entered classes' codes. */
export function ruleApplies(appliesTo: string[], enteredCodes: ClassCodeFlags[]): boolean {
  if (appliesTo.length === 0) return true;
  return enteredCodes.some((code) =>
    appliesTo.some((tag) => {
      const norm = normalizeTag(tag);
      if (code.code.toLowerCase() === norm) return true;
      const flagKey = FLAG_ALIASES[norm];
      return flagKey ? code[flagKey] : false;
    })
  );
}

function resolveField(ctx: RuleEngineContext, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = ctx;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function coerceToMatch(raw: string, sample: unknown): unknown {
  if (typeof sample === "boolean") return raw.trim().toLowerCase() === "true";
  if (typeof sample === "number") return Number(raw);
  return raw;
}

function evaluateCondition(
  condition: { field: string; operator: string; value: string },
  ctx: RuleEngineContext
): boolean {
  const actual = resolveField(ctx, condition.field);
  const { operator, value } = condition;

  if (operator === "exists") return actual !== undefined && actual !== null;
  if (actual === undefined || actual === null) return false;

  switch (operator) {
    case "equals":
      return actual === coerceToMatch(value, actual);
    case "not_equals":
      return actual !== coerceToMatch(value, actual);
    case "greater_than":
      return typeof actual === "number" && actual > Number(value);
    case "less_than":
      return typeof actual === "number" && actual < Number(value);
    case "in":
      return value
        .split(",")
        .map((v) => v.trim())
        .includes(String(actual));
    case "not_in":
      return !value
        .split(",")
        .map((v) => v.trim())
        .includes(String(actual));
    default:
      return false;
  }
}

export function evaluateEligibilityRules(
  rules: EligibilityRuleLike[],
  ctx: RuleEngineContext,
  enteredCodes: ClassCodeFlags[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const rule of rules) {
    if (!ruleApplies(rule.appliesTo, enteredCodes)) continue;
    const compliant = rule.conditions.every((c) => evaluateCondition(c, ctx));
    if (!compliant) {
      issues.push({ code: `rule:${rule.ruleKey}`, severity: rule.severity, message: rule.message });
    }
  }
  return issues;
}
