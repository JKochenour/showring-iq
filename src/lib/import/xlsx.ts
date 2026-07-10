import { readSheet } from "read-excel-file/browser";

/** Formats an Excel cell value as the plain string our CSV pipeline expects. */
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    // Excel dates have no timezone — format in UTC to avoid an off-by-one day.
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value);
}

/** Parses the first sheet of an .xlsx/.xls file into the same {headers, rows} shape as parseCsv. */
export async function parseXlsx(file: File | Blob): Promise<{ headers: string[]; rows: string[][] }> {
  const sheet = await readSheet(file);
  const stringRows = sheet
    .map((row) => row.map(cellToString))
    .filter((row) => row.some((cell) => cell.trim() !== ""));

  const [headers, ...rows] = stringRows;
  return { headers: (headers ?? []).map((h) => h.trim()), rows };
}
