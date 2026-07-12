/**
 * NRHA event classifications (Show Rules G(10)), transcribed from the 2024
 * NRHA Handbook. Fixed association reference material, same precedent as
 * nrha-patterns.ts / nrha-payback-schedules.ts.
 *
 * C through AA are bands of total added money across the entire event.
 * D is a Ride & Slide event — a declared type, not a money band.
 */

export type EventClassification = "D" | "C" | "B" | "BB" | "A" | "AA";

export const EVENT_CLASSIFICATIONS: {
  value: EventClassification;
  label: string;
}[] = [
  { value: "D", label: "D — Ride & Slide event" },
  { value: "C", label: "C — $0–$999 added money" },
  { value: "B", label: "B — $1,000–$14,999 added money" },
  { value: "BB", label: "BB — $15,000–$49,999 added money" },
  { value: "A", label: "A — $50,000–$99,999 added money" },
  { value: "AA", label: "AA — $100,000+ added money" },
];

/** Classification implied by total added money across the event.
 * D can't be derived from money — it's a declared Ride & Slide event. */
export function classificationForAddedMoney(
  totalAddedCents: number
): Exclude<EventClassification, "D"> {
  if (totalAddedCents >= 100_000_00) return "AA";
  if (totalAddedCents >= 50_000_00) return "A";
  if (totalAddedCents >= 15_000_00) return "BB";
  if (totalAddedCents >= 1_000_00) return "B";
  return "C";
}

export type ChecklistStatus = "pass" | "fail" | "warning" | "manual";

export interface ChecklistItem {
  status: ChecklistStatus;
  label: string;
  detail?: string;
}

export interface ClassJudgeInfo {
  classNumber: number;
  name: string;
  addedMoneyCents: number;
  judgeCount: number;
}

/** A staff member reduced to what the checklist compares on. Two rows with
 * the same non-null userId — or, failing that, the same trimmed
 * case-insensitive display name — are treated as the same individual. */
export interface StaffInfo {
  role: string;
  userId: string | null;
  displayName: string;
}

function personKey(s: StaffInfo): string {
  return s.userId ?? `name:${s.displayName.trim().toLowerCase()}`;
}

export function computeClassificationChecklist(opts: {
  declared: EventClassification | null;
  totalAddedCents: number;
  staff: StaffInfo[];
  classes: ClassJudgeInfo[];
  /** Distinct rider names on the show's entries, for the A/AA
   * "Show Secretary may not show" cross-check. */
  riderNames: string[];
}): ChecklistItem[] {
  const { declared, totalAddedCents, staff, classes, riderNames } = opts;
  const items: ChecklistItem[] = [];
  const implied = classificationForAddedMoney(totalAddedCents);
  const level = declared ?? implied;

  // Declared vs money-implied classification. D is exempt (declared type).
  if (declared && declared !== "D" && declared !== implied) {
    items.push({
      status: "warning",
      label: `Declared classification (${declared}) doesn't match total added money`,
      detail: `Total added money implies a ${implied} event.`,
    });
  } else if (!declared) {
    items.push({
      status: "warning",
      label: "No classification declared",
      detail: `Total added money implies a ${implied} event — the checklist below assumes ${implied}.`,
    });
  } else {
    items.push({
      status: "pass",
      label: `Declared classification ${declared} matches total added money`,
    });
  }

  const byRole = (role: string) => staff.filter((s) => s.role === role);
  const secretaries = byRole("secretary");
  const managers = byRole("manager");
  const stewards = [...byRole("steward"), ...byRole("show_representative")];
  const videographers = byRole("videographer");

  const needsSteward = level === "BB" || level === "A" || level === "AA";

  // Show Secretary — every classification.
  items.push(
    secretaries.length > 0
      ? { status: "pass", label: "Show Secretary assigned" }
      : { status: "fail", label: "No Show Secretary assigned" }
  );

  // Show Manager / Show Representative — every classification.
  const managerOrRep = [...managers, ...byRole("show_representative")];
  items.push(
    managerOrRep.length > 0
      ? { status: "pass", label: "Show Manager / Show Representative assigned" }
      : { status: "fail", label: "No Show Manager / Show Representative assigned" }
  );

  // Separate individuals: secretary + manager must be two people; BB/A/AA
  // additionally require a representative/steward for at least three.
  const keyOf = (list: StaffInfo[]) => new Set(list.map(personKey));
  if (secretaries.length > 0 && managerOrRep.length > 0) {
    const overlap = [...keyOf(secretaries)].filter((k) =>
      keyOf(managerOrRep).has(k)
    );
    const distinct = new Set([
      ...keyOf(secretaries),
      ...keyOf(managerOrRep),
    ]).size;
    if (overlap.length > 0 && distinct < 2) {
      items.push({
        status: "fail",
        label: "Show Secretary and Show Manager must be two separate individuals",
      });
    } else {
      items.push({
        status: "pass",
        label: "Show Secretary and Show Manager are separate individuals",
      });
    }
  }
  if (needsSteward) {
    if (stewards.length === 0) {
      items.push({
        status: "fail",
        label: `${level} events require a Show Representative/Steward`,
        detail: "BB, A and AA events must have at least three individuals: Show Secretary, Show Manager, and Show Representative/Steward.",
      });
    } else {
      const distinct = new Set([
        ...keyOf(secretaries),
        ...keyOf(managers),
        ...keyOf(stewards),
      ]).size;
      items.push(
        distinct >= 3
          ? {
              status: "pass",
              label: "Secretary, Manager and Representative/Steward are three individuals",
            }
          : {
              status: "fail",
              label: `${level} events require at least three separate individuals (Secretary, Manager, Representative/Steward)`,
            }
      );
    }
  }

  // Videographer: strongly recommended at BB, required at A/AA.
  if (level === "A" || level === "AA") {
    items.push(
      videographers.length > 0
        ? { status: "pass", label: "Official videographer assigned (required for all classes)" }
        : {
            status: "fail",
            label: `${level} events require an official videographer for all classes`,
            detail: "Video must be captured manually, not by automated systems.",
          }
    );
  } else if (level === "BB") {
    items.push(
      videographers.length > 0
        ? { status: "pass", label: "Official videographer assigned" }
        : {
            status: "warning",
            label: "Official videographer strongly recommended for BB events",
            detail: "Video must be captured manually, not by automated systems.",
          }
    );
  }

  // AA: NRHA Show Steward must officiate the entire show.
  if (level === "AA") {
    items.push(
      byRole("steward").length > 0
        ? {
            status: "manual",
            label: "Confirm the NRHA Show Steward officiates for the entire duration of the show",
          }
        : {
            status: "fail",
            label: "AA events require an NRHA Show Steward for the entire duration of the show",
          }
    );
  }

  // AA: five judges for $50k+ added classes; monitor + five judges at $100k+.
  if (level === "AA") {
    for (const c of classes) {
      if (c.addedMoneyCents >= 50_000_00 && c.judgeCount < 5) {
        items.push({
          status: "fail",
          label: `Class ${c.classNumber} (${c.name}) offers ${c.addedMoneyCents >= 100_000_00 ? "$100,000+" : "$50,000–$99,999"} added and must use five judges`,
          detail: `${c.judgeCount} judge${c.judgeCount === 1 ? "" : "s"} currently assigned.${c.addedMoneyCents >= 100_000_00 ? " A Judges Monitor is also required." : ""}`,
        });
      }
    }
    if (
      classes.some((c) => c.addedMoneyCents >= 50_000_00 && c.judgeCount >= 5)
    ) {
      items.push({
        status: "pass",
        label: "Five-judge requirement met for $50,000+ added classes",
      });
    }
  }

  // A/AA: the Show Secretary may not show. Rider names are free text, so
  // this is a name match — a hit is a warning to investigate, not proof.
  if (level === "A" || level === "AA") {
    const riderSet = new Set(riderNames.map((n) => n.trim().toLowerCase()));
    const showingSecretaries = secretaries.filter((s) =>
      riderSet.has(s.displayName.trim().toLowerCase())
    );
    items.push(
      showingSecretaries.length > 0
        ? {
            status: "warning",
            label: `Show Secretary may not show at ${level} events — "${showingSecretaries[0].displayName}" matches a rider name on an entry`,
          }
        : {
            status: "pass",
            label: "No entry rider name matches the Show Secretary",
            detail: "Name-based check only — confirm independently.",
          }
    );
    items.push({
      status: "manual",
      label: "Confirm judges do not judge more than 12 hours per day (actual judging, excluding breaks)",
    });
    items.push({
      status: "manual",
      label: "Judges Monitor is recommended for the entire event",
    });
  }

  // Manual confirmations that apply to every classification.
  items.push({
    status: "manual",
    label: "Confirm the Show Secretary or Show Manager is NRHA certified",
  });
  items.push({
    status: "manual",
    label: "Confirm all judges are on the NRHA Judges List and were not hired by an immediate family member",
  });
  if (level === "B" || level === "BB" || level === "A" || level === "AA") {
    items.push({
      status: "manual",
      label: "Confirm the Show Representative/Steward is not an immediate family member of the Show Secretary or Show Manager",
    });
  }

  return items;
}
