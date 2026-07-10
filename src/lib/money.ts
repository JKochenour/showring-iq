/** Money is stored as integer cents everywhere — never floats. */

/** "25", "25.5", "25.50" → 2550. Empty/blank → 0. */
export function dollarsToCents(value: string): number {
  const trimmed = value.trim();
  if (trimmed === "") return 0;
  const [dollars, cents = ""] = trimmed.split(".");
  return (
    parseInt(dollars || "0", 10) * 100 +
    parseInt((cents + "00").slice(0, 2), 10)
  );
}

/** 2550 → "$25.50" */
export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

/** 2550 → "25.50" (for form default values) */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export const MONEY_PATTERN = /^\d{1,7}(\.\d{1,2})?$/;
