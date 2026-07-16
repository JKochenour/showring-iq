/**
 * Show-bill parser: turns the class-schedule text of a published show
 * bill (pasted, or extracted from the PDF) into structured per-session
 * class drafts the office can review and bulk-create.
 *
 * Built against the EPRHA Fire Cracker Classic bill format:
 *
 *   Friday, July 17th INDOOR - 7:30 AM Start
 *   Class  Added $  Entry Fee  Judge  Pattern
 *   Open              $2,000   $200   $100
 *   Green Rider 1     JACKPOT  $20    -
 *   Youth 13 & U      POINTS   $10    -        14
 *   Future Sliders    -        -      -
 *
 * Sessions are day/arena/start-time headers; class rows carry up to
 * three money-ish columns (added $, entry fee, judge fee — any of which
 * can be a dollar amount, JACKPOT, POINTS, or "-") and an optional
 * trailing pattern (1-18, A, B, or TBD; often printed once for a group
 * of rows, so it lands on whichever row the text layer attached it to).
 * Deterministic — no OCR or LLM; if a bill's text doesn't match, the
 * rows simply don't parse and the office edits the preview by hand.
 */

import { decodeHtmlEntities } from "@/lib/import/normalize";

export interface ParsedClassDraft {
  name: string;
  /** null = not stated ("-"); 0 with jackpot/points label = no fixed purse */
  addedMoneyCents: number | null;
  addedLabel: "amount" | "jackpot" | "points" | "none";
  entryFeeCents: number | null;
  judgeFeeCents: number | null;
  /** numeric NRHA pattern when the row carried one */
  patternNumber: number | null;
  /** 'A' | 'B' | 'TBD' style pattern annotations that aren't numeric */
  patternNote: string | null;
}

export interface ParsedSession {
  /** e.g. "Friday, July 17th INDOOR - 7:30 AM Start" */
  header: string;
  /** ISO date when the header carried a parseable month + day */
  date: string | null;
  arena: string | null;
  startTime: string | null;
  classes: ParsedClassDraft[];
}

const WEEKDAYS =
  /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i;
const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

const MONEYISH = /^(\$[\d,]+(?:\.\d{2})?|jackpot|points|-|–|—)$/i;
const PATTERNISH = /^(\d{1,2}|[AB]|TBD)$/i;
const HEADER_ROW = /^class\s+added/i;

function moneyToCents(token: string): {
  cents: number | null;
  label: ParsedClassDraft["addedLabel"];
} {
  const t = token.toLowerCase();
  if (t === "jackpot") return { cents: 0, label: "jackpot" };
  if (t === "points") return { cents: 0, label: "points" };
  if (t === "-" || t === "–" || t === "—") return { cents: null, label: "none" };
  const digits = token.replace(/[^0-9.]/g, "");
  const value = Math.round(parseFloat(digits) * 100);
  return Number.isFinite(value) ? { cents: value, label: "amount" } : { cents: null, label: "none" };
}

function parseSessionHeader(line: string, defaultYear: number): Omit<ParsedSession, "classes"> | null {
  if (!WEEKDAYS.test(line)) return null;
  // Must look like a header, not a class named after a day: require a
  // month name or a start time or an arena word on the same line.
  const monthMatch = line.match(
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/i
  );
  const timeMatch = line.match(/(\d{1,2}:\d{2})\s*(am|pm)/i);
  const arenaMatch = line.match(/\b(indoor|outdoor|covered|main arena|arena\s+\w+)\b/i);
  if (!monthMatch && !timeMatch && !arenaMatch) return null;

  let date: string | null = null;
  if (monthMatch) {
    const month = MONTHS[monthMatch[1].toLowerCase()];
    const day = parseInt(monthMatch[2], 10);
    const year = monthMatch[3] ? parseInt(monthMatch[3], 10) : defaultYear;
    if (month && day >= 1 && day <= 31) {
      date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return {
    header: line.trim(),
    date,
    arena: arenaMatch ? arenaMatch[1].toUpperCase() : null,
    startTime: timeMatch ? `${timeMatch[1]} ${timeMatch[2].toUpperCase()}` : null,
  };
}

function parseClassRow(line: string): ParsedClassDraft | null {
  const tokens = line.trim().split(/\s+/);
  if (tokens.length < 2) return null;

  // PDF text extraction merges sidebar text into class rows at the same
  // vertical position, so the money columns can sit mid-line, not at the
  // end. Find the first contiguous run of at least two money-ish tokens:
  // name = everything before it, optional pattern = the token right
  // after it, anything else after is sidebar noise and dropped.
  let runStart = -1;
  let runLength = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (!MONEYISH.test(tokens[i])) continue;
    let j = i;
    while (j < tokens.length && MONEYISH.test(tokens[j])) j++;
    if (j - i >= 2) {
      runStart = i;
      runLength = Math.min(j - i, 3);
      break;
    }
    i = j;
  }
  // A real class row in this format has at least the added-$ and
  // entry-fee columns (either may be "-").
  if (runStart < 1) return null;

  const money = tokens.slice(runStart, runStart + runLength);
  const afterRun = tokens[runStart + runLength];
  const pattern =
    afterRun !== undefined && PATTERNISH.test(afterRun) ? afterRun : null;

  const name = tokens.slice(0, runStart).join(" ").trim();
  if (name.length < 2 || HEADER_ROW.test(line)) return null;

  // Columns map left-to-right: added $, entry fee, judge fee.
  const [addedTok, entryTok, judgeTok] = [
    money[0],
    money[1] ?? "-",
    money[2] ?? "-",
  ];
  const added = moneyToCents(addedTok);
  const entry = moneyToCents(entryTok);
  const judge = moneyToCents(judgeTok);

  // Rows where every column is "-" (e.g. "Future Sliders - - -") are
  // still classes — they just have nothing announced yet.
  const patternIsNumeric = pattern !== null && /^\d{1,2}$/.test(pattern);
  return {
    name,
    addedMoneyCents: added.cents,
    addedLabel: added.label,
    entryFeeCents: entry.label === "amount" ? entry.cents : null,
    judgeFeeCents: judge.label === "amount" ? judge.cents : null,
    patternNumber: patternIsNumeric ? parseInt(pattern!, 10) : null,
    patternNote: pattern !== null && !patternIsNumeric ? pattern.toUpperCase() : null,
  };
}

export function parseShowBill(text: string, defaultYear: number): ParsedSession[] {
  const sessions: ParsedSession[] = [];
  let current: ParsedSession | null = null;

  // Bills pasted from a web page (or extracted from an HTML-derived PDF)
  // can carry literal entities like "&amp;" in class names — decode before
  // parsing so class names go into the DB clean.
  for (const rawLine of decodeHtmlEntities(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || HEADER_ROW.test(line)) continue;

    const header = parseSessionHeader(line, defaultYear);
    if (header) {
      current = { ...header, classes: [] };
      sessions.push(current);
      continue;
    }
    if (!current) continue;

    // A pattern number for a GROUP of classes prints in a merged cell,
    // which the text layer emits as its own line (sometimes with sidebar
    // noise appended, e.g. "17 Naike Bell,"). If the line starts with a
    // pattern-ish token and carries no money columns, attach it to the
    // most recent class that has no pattern yet.
    const firstToken = line.split(/\s+/)[0];
    const hasMoney = line.split(/\s+/).filter((t) => MONEYISH.test(t)).length >= 2;
    if (PATTERNISH.test(firstToken) && !hasMoney && current.classes.length > 0) {
      const target = [...current.classes]
        .reverse()
        .find((c) => c.patternNumber === null && c.patternNote === null);
      if (target) {
        if (/^\d{1,2}$/.test(firstToken)) {
          target.patternNumber = parseInt(firstToken, 10);
        } else {
          target.patternNote = firstToken.toUpperCase();
        }
      }
      continue;
    }

    const cls = parseClassRow(line);
    if (cls) current.classes.push(cls);
  }

  return sessions.filter((s) => s.classes.length > 0);
}

/** Heuristic for the youth fee exemptions (00027): pre-checks the
 * is_youth box in the preview; the office can override. */
export function looksLikeYouthClass(name: string): boolean {
  return /\byouth\b|short stirrup|jr\.?\s*sliders|future sliders/i.test(name);
}
