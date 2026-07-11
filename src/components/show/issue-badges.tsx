import type { Severity, ValidationIssue } from "@/lib/validation-engine";

const SEVERITY_STYLES: Record<Severity, string> = {
  critical: "bg-red-600 text-white dark:bg-red-700",
  blocking: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
};

export function SeverityBadge({
  severity,
  count,
}: {
  severity: Severity;
  count?: number;
}) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLES[severity]}`}
    >
      {count !== undefined ? `${count} ${severity}` : severity}
    </span>
  );
}

export function IssueSummaryBadges({ issues }: { issues: ValidationIssue[] }) {
  if (issues.length === 0) {
    return (
      <span className="inline-block rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
        ✓ clear
      </span>
    );
  }
  const counts = new Map<Severity, number>();
  for (const issue of issues) {
    counts.set(issue.severity, (counts.get(issue.severity) ?? 0) + 1);
  }
  const order: Severity[] = ["critical", "blocking", "warning", "info"];
  return (
    <span className="flex flex-wrap gap-1">
      {order
        .filter((s) => counts.has(s))
        .map((s) => (
          <SeverityBadge key={s} severity={s} count={counts.get(s)} />
        ))}
    </span>
  );
}

export function IssueList({ issues }: { issues: ValidationIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {issues.map((issue, index) => (
        <li key={`${issue.code}-${index}`} className="flex items-start gap-2 text-sm">
          <SeverityBadge severity={issue.severity} />
          {issue.associationName && (
            <span className="inline-block whitespace-nowrap rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {issue.associationName}
            </span>
          )}
          <span>{issue.message}</span>
        </li>
      ))}
    </ul>
  );
}
