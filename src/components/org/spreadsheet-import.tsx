"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { parseCsv } from "@/lib/import/csv";
import { parseXlsx } from "@/lib/import/xlsx";
import { guessMapping, type ImportFieldConfig } from "@/lib/import/field-config";
import { Alert, Button, ButtonLink, Card, Select } from "@/components/ui";

type ImportRowResult = {
  row: number;
  name: string;
  status: "created" | "skipped" | "updated" | "error";
  message?: string;
};

type ImportSummary = {
  created: number;
  skipped?: number;
  updated?: number;
  errors: number;
  results: ImportRowResult[];
};

const MAX_ROWS = 1000;
const PREVIEW_ROWS = 8;

export function SpreadsheetImport({
  scopeId,
  backHref,
  entityLabelPlural,
  fields,
  sampleRow,
  runImport,
}: {
  /** The id passed as runImport's first argument — an org id, rule package id, etc. */
  scopeId: string;
  backHref: string;
  entityLabelPlural: string;
  fields: ImportFieldConfig[];
  sampleRow: Record<string, string>;
  runImport: (
    scopeId: string,
    rows: Record<string, string>[]
  ) => Promise<ImportSummary | { error?: string }>;
}) {
  const [fileName, setFileName] = useState<string>();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, number | null>>({});
  const [parseError, setParseError] = useState<string>();
  const [summary, setSummary] = useState<ImportSummary>();
  const [submitError, setSubmitError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const templateHref = useMemo(() => {
    const headerLine = fields.map((f) => f.label).join(",");
    const sampleLine = fields.map((f) => sampleRow[f.key] ?? "").join(",");
    const csv = `${headerLine}\n${sampleLine}\n`;
    return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
  }, [fields, sampleRow]);

  async function handleFile(file: File) {
    setParseError(undefined);
    setSummary(undefined);
    setSubmitError(undefined);

    const isExcel = /\.xlsx?$/i.test(file.name);
    let parsed: { headers: string[]; rows: string[][] };
    try {
      parsed = isExcel ? await parseXlsx(file) : parseCsv(await file.text());
    } catch {
      setParseError(
        isExcel
          ? "Couldn't read that Excel file. Make sure it's a valid .xlsx or .xls file."
          : "Couldn't read that file as CSV."
      );
      return;
    }
    if (parsed.headers.length === 0) {
      setParseError("Couldn't find a header row. Make sure the first row has column names.");
      return;
    }
    if (parsed.rows.length === 0) {
      setParseError("No data rows found below the header.");
      return;
    }
    setFileName(file.name);
    setHeaders(parsed.headers);
    setRows(parsed.rows.slice(0, MAX_ROWS));
    setMapping(guessMapping(parsed.headers, fields));
  }

  function mappedRows(): Record<string, string>[] {
    return rows.map((row) => {
      const record: Record<string, string> = {};
      for (const field of fields) {
        const colIndex = mapping[field.key];
        record[field.key] = colIndex !== null && colIndex !== undefined ? (row[colIndex] ?? "") : "";
      }
      return record;
    });
  }

  const requiredUnmapped = fields.filter((f) => f.required && mapping[f.key] == null);

  function handleImport() {
    setSubmitError(undefined);
    startTransition(async () => {
      const result = await runImport(scopeId, mappedRows());
      if ("error" in result && result.error) {
        setSubmitError(result.error);
        return;
      }
      setSummary(result as ImportSummary);
    });
  }

  if (summary) {
    const problems = summary.results.filter((r) => r.status !== "created" || r.message);
    return (
      <Card>
        <Alert tone={summary.errors > 0 ? "info" : "success"}>
          Imported {summary.created} {entityLabelPlural.toLowerCase()}
          {summary.updated ? `, updated ${summary.updated} existing` : ""}
          {summary.skipped ? `, skipped ${summary.skipped} already-existing` : ""}
          {summary.errors > 0 ? `, ${summary.errors} row(s) had errors` : ""}.
        </Alert>
        {problems.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="py-2 pr-4 font-medium">Row</th>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {problems.map((r) => (
                  <tr key={r.row}>
                    <td className="py-2 pr-4 text-zinc-500 dark:text-zinc-400">{r.row}</td>
                    <td className="py-2 pr-4">{r.name}</td>
                    <td className="py-2 pr-4 capitalize">{r.status}</td>
                    <td className="py-2 text-zinc-500 dark:text-zinc-400">{r.message ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-6 flex gap-3">
          <ButtonLink href={backHref}>Done</ButtonLink>
          <Button
            variant="secondary"
            onClick={() => {
              setSummary(undefined);
              setFileName(undefined);
              setHeaders([]);
              setRows([]);
              setMapping({});
            }}
          >
            Import another file
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="text-sm font-semibold">1. Upload a spreadsheet</h3>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Upload a .csv, .xlsx, or .xls file exported from Excel or Google Sheets. For an .xlsx/.xls
          file, only the first sheet is read. Not sure of the format?{" "}
          <a href={templateHref} download={`${entityLabelPlural.toLowerCase()}-import-template.csv`} className="text-emerald-700 hover:underline dark:text-emerald-500">
            Download a CSV template
          </a>
          .
        </p>
        <input
          type="file"
          accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="mt-4 block w-full text-sm text-zinc-700 file:mr-4 file:rounded-md file:border-0 file:bg-emerald-700 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-emerald-800 dark:text-zinc-300"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        {fileName && (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {fileName} — {rows.length} row{rows.length === 1 ? "" : "s"}
            {rows.length >= MAX_ROWS ? ` (capped at ${MAX_ROWS})` : ""}
          </p>
        )}
        {parseError && (
          <div className="mt-4">
            <Alert>{parseError}</Alert>
          </div>
        )}
      </Card>

      {headers.length > 0 && (
        <>
          <Card>
            <h3 className="text-sm font-semibold">2. Match your columns</h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              We guessed a mapping from your column headers. Fix anything that&apos;s wrong.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {fields.map((field) => (
                <div key={field.key} className="flex items-center gap-3">
                  <label className="w-40 shrink-0 text-sm text-zinc-700 dark:text-zinc-300">
                    {field.label}
                    {field.required && <span className="text-red-600"> *</span>}
                  </label>
                  <Select
                    value={mapping[field.key] ?? ""}
                    onChange={(e) =>
                      setMapping((m) => ({
                        ...m,
                        [field.key]: e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                  >
                    <option value="">— Don&apos;t import —</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
            {requiredUnmapped.length > 0 && (
              <div className="mt-4">
                <Alert>
                  Map a column for: {requiredUnmapped.map((f) => f.label).join(", ")} before importing.
                </Alert>
              </div>
            )}
          </Card>

          <Card>
            <h3 className="text-sm font-semibold">3. Preview</h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              First {Math.min(PREVIEW_ROWS, rows.length)} of {rows.length} rows, as they&apos;ll be imported.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    {fields.map((f) => (
                      <th key={f.key} className="py-2 pr-4 font-medium">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {rows.slice(0, PREVIEW_ROWS).map((row, i) => (
                    <tr key={i}>
                      {fields.map((f) => {
                        const colIndex = mapping[f.key];
                        const value = colIndex != null ? (row[colIndex] ?? "") : "";
                        return (
                          <td key={f.key} className="py-2 pr-4 text-zinc-500 dark:text-zinc-400">
                            {value || "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {submitError && (
              <div className="mt-4">
                <Alert>{submitError}</Alert>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <Button onClick={handleImport} disabled={isPending || requiredUnmapped.length > 0}>
                {isPending ? "Importing…" : `Import ${rows.length} row${rows.length === 1 ? "" : "s"}`}
              </Button>
              <ButtonLink href={backHref} variant="secondary">
                Cancel
              </ButtonLink>
            </div>
          </Card>
        </>
      )}

      {headers.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          <Link href={backHref} className="hover:underline">
            ← Back
          </Link>
        </p>
      )}
    </div>
  );
}
