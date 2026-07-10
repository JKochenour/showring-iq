/** Scores are stored as integer tenths of a point — never floats — same
 * convention as money-as-cents. "70.5" <-> 705. */

export function scoreToTenths(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return Math.round(parseFloat(trimmed) * 10);
}

export function tenthsToInput(tenths: number | null | undefined): string {
  if (tenths === null || tenths === undefined) return "";
  return (tenths / 10).toFixed(1);
}

export function formatScore(tenths: number | null | undefined): string {
  if (tenths === null || tenths === undefined) return "—";
  return (tenths / 10).toFixed(1);
}

export const SCORE_PATTERN = /^\d{1,4}(\.\d)?$/;
