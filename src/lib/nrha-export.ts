/**
 * NRHA ReinerSuite CSV — the first association export target.
 *
 * Field order, delimiter, and quoting are exact per CLAUDE.md and must
 * not drift: semicolon-delimited, every field quoted, required header,
 * no blank fields, money as "0.00", numeric pattern numbers.
 *
 * Score codes: -2 = scratched, -1 = no score (per CLAUDE.md). "dq" and
 * "excused" aren't separately coded in the ReinerSuite guide excerpt we
 * have, so they're also written as -1 (no score) — flagged here since a
 * real integration should confirm against NRHA's current guide.
 *
 * EntryCount/ShownCount semantics are a reasonable reading of the spec,
 * not a verified NRHA definition — confirm before a real submission.
 */

import type { Severity } from "@/lib/validation-engine";

export const NRHA_CSV_HEADER = [
  "ShowNum",
  "ShowName",
  "ClassName",
  "ClassCode",
  "PatternNum",
  "EntryCount",
  "ShownCount",
  "GoType",
  "GoNum",
  "Horse",
  "HorseNrha",
  "Member",
  "MemberNrha",
  "BackNum",
  "PlaceNum",
  "TotalScore",
  "MoneyWon",
] as const;

export interface NrhaCsvRow {
  showNum: string;
  showName: string;
  className: string;
  classCode: string;
  patternNum: number;
  entryCount: number;
  shownCount: number;
  goType: string;
  goNum: number;
  horse: string;
  horseNrha: string;
  member: string;
  memberNrha: string;
  backNum: number;
  placeNum: number;
  /** Already formatted per the score-code rules: "-2.0", "-1.0", or the real score. */
  totalScore: string;
  /** Plain decimal, no currency symbol: "0.00" */
  moneyWon: string;
}

function csvField(value: string | number): string {
  const str = String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

export function buildNrhaCsv(rows: NrhaCsvRow[]): string {
  const lines = [NRHA_CSV_HEADER.map(csvField).join(";")];
  for (const row of rows) {
    lines.push(
      [
        row.showNum,
        row.showName,
        row.className,
        row.classCode,
        row.patternNum,
        row.entryCount,
        row.shownCount,
        row.goType,
        row.goNum,
        row.horse,
        row.horseNrha,
        row.member,
        row.memberNrha,
        row.backNum,
        row.placeNum,
        row.totalScore,
        row.moneyWon,
      ]
        .map(csvField)
        .join(";")
    );
  }
  // NRHA/Windows-oriented tooling expects CRLF line endings
  return lines.join("\r\n") + "\r\n";
}

export interface ReadinessIssue {
  code: string;
  severity: Severity;
  message: string;
}

export interface ReadinessContext {
  showNumber: string | null;
  includedClassCount: number;
  classesMissingCode: string[];
  classesMissingPattern: string[];
  entriesMissingBackNumber: string[];
  entriesMissingScore: string[];
  horsesMissingLicense: string[];
  ridersMissingMembership: string[];
}

export function checkNrhaReadiness(ctx: ReadinessContext): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];

  if (!ctx.showNumber) {
    issues.push({
      code: "show_number_missing",
      severity: "blocking",
      message: "Show/approval number is not set (Settings tab).",
    });
  }
  if (ctx.includedClassCount === 0) {
    issues.push({
      code: "no_included_classes",
      severity: "blocking",
      message: "No classes are official or results-posted yet — nothing to export.",
    });
  }
  for (const name of ctx.classesMissingCode) {
    issues.push({
      code: "class_missing_code",
      severity: "blocking",
      message: `${name} has no NRHA class code.`,
    });
  }
  for (const name of ctx.classesMissingPattern) {
    issues.push({
      code: "class_missing_pattern",
      severity: "blocking",
      message: `${name} has no pattern number.`,
    });
  }
  for (const name of ctx.entriesMissingBackNumber) {
    issues.push({
      code: "entry_missing_back_number",
      severity: "blocking",
      message: `${name} has no back number assigned.`,
    });
  }
  for (const name of ctx.entriesMissingScore) {
    issues.push({
      code: "entry_missing_score",
      severity: "blocking",
      message: `${name} has no score recorded.`,
    });
  }
  for (const name of ctx.horsesMissingLicense) {
    issues.push({
      code: "horse_missing_license",
      severity: "warning",
      message: `${name}'s horse has no NRHA registration/competition license on file.`,
    });
  }
  for (const name of ctx.ridersMissingMembership) {
    issues.push({
      code: "rider_missing_membership",
      severity: "warning",
      message: `${name} has no NRHA membership number on file.`,
    });
  }

  return issues;
}

export function isExportReady(issues: ReadinessIssue[]): boolean {
  return !issues.some((i) => i.severity === "blocking" || i.severity === "critical");
}
