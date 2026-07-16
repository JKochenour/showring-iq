"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  extractShowBillText,
  importBillClasses,
} from "@/app/(app)/shows/[id]/classes/actions";
import {
  looksLikeYouthClass,
  parseShowBill,
  type ParsedSession,
} from "@/lib/import/show-bill";
import { centsToInput } from "@/lib/money";
import { Alert, Button, Card, Input, Label } from "@/components/ui";

interface PreviewRow {
  include: boolean;
  name: string;
  entryFee: string;
  addedMoney: string;
  scheduledDate: string;
  arena: string;
  patternNumber: string;
  isYouth: boolean;
  notes: string;
}

interface PreviewSession {
  header: string;
  rows: PreviewRow[];
}

function sessionNote(s: ParsedSession): string {
  // Arena is a real class field now (00048), not just a note.
  return s.startTime ? `${s.startTime} session` : "";
}

function toPreview(sessions: ParsedSession[]): PreviewSession[] {
  return sessions.map((s) => ({
    header: s.header,
    rows: s.classes.map((c) => {
      const noteParts: string[] = [];
      const base = sessionNote(s);
      if (base) noteParts.push(base);
      if (c.addedLabel === "jackpot") noteParts.push("Jackpot added money");
      if (c.addedLabel === "points") noteParts.push("Points-only class");
      if (c.judgeFeeCents !== null) {
        noteParts.push(`Judge fee ${centsToInput(c.judgeFeeCents).replace(/\.00$/, "")}`);
      }
      if (c.patternNote) noteParts.push(`Pattern ${c.patternNote}`);
      return {
        include: true,
        name: c.name,
        entryFee: c.entryFeeCents !== null ? centsToInput(c.entryFeeCents) : "",
        addedMoney:
          c.addedLabel === "amount" && c.addedMoneyCents !== null
            ? centsToInput(c.addedMoneyCents)
            : "",
        scheduledDate: s.date ?? "",
        arena: s.arena ?? "",
        patternNumber: c.patternNumber !== null ? String(c.patternNumber) : "",
        isYouth: looksLikeYouthClass(c.name),
        notes: noteParts.join(" · "),
      };
    }),
  }));
}

export function ShowBillImport({
  showId,
  defaultYear,
}: {
  showId: string;
  defaultYear: number;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [sessions, setSessions] = useState<PreviewSession[] | null>(null);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const runParse = (raw: string) => {
    const parsed = parseShowBill(raw, defaultYear);
    if (parsed.length === 0) {
      setError(
        "No class schedule found. Expected day headers like “Friday, July 17th INDOOR - 7:30 AM Start” followed by class rows with fee columns."
      );
      setSessions(null);
      return;
    }
    setError(undefined);
    setSessions(toPreview(parsed));
  };

  const onPickFile = (file: File | null) => {
    if (!file) return;
    setError(undefined);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("file", file);
      const result = await extractShowBillText(fd);
      if (result.error) setError(result.error);
      else if (result.text) {
        setText(result.text);
        runParse(result.text);
      }
    });
  };

  const updateRow = (si: number, ri: number, patch: Partial<PreviewRow>) => {
    setSessions((prev) => {
      if (!prev) return prev;
      const next = prev.map((s) => ({ ...s, rows: [...s.rows] }));
      next[si].rows[ri] = { ...next[si].rows[ri], ...patch };
      return next;
    });
  };

  const includedRows = (sessions ?? []).flatMap((s) =>
    s.rows.filter((r) => r.include)
  );

  const create = () => {
    setError(undefined);
    startTransition(async () => {
      const result = await importBillClasses({
        showId,
        classes: includedRows.map((r) => ({
          name: r.name,
          entryFee: r.entryFee,
          addedMoney: r.addedMoney,
          scheduledDate: r.scheduledDate,
          arena: r.arena,
          patternNumber: r.patternNumber ? parseInt(r.patternNumber, 10) : null,
          isYouth: r.isYouth,
          notes: r.notes,
        })),
      });
      if (result.error) setError(result.error);
      else router.push(`/shows/${showId}/classes`);
    });
  };

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}

      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="bill-file">Upload the show bill (PDF)</Label>
            <input
              id="bill-file"
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="mt-1 block w-full text-sm text-stone-600 file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-stone-200 dark:text-stone-300 dark:file:bg-stone-800 dark:hover:file:bg-stone-700"
              disabled={isPending}
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              Needs a text layer (exported PDFs have one; phone photos and
              scans don&apos;t — paste the text instead).
            </p>
          </div>
          <div>
            <Label htmlFor="bill-text">…or paste the class schedule text</Label>
            <textarea
              id="bill-text"
              rows={6}
              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
              placeholder={"Friday, July 17th INDOOR - 7:30 AM Start\nOpen  $2,000  $200  $100\n…"}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <Button
              variant="secondary"
              className="mt-2"
              disabled={isPending || !text.trim()}
              onClick={() => runParse(text)}
            >
              {isPending ? "Working…" : "Parse text"}
            </Button>
          </div>
        </div>
      </Card>

      {sessions &&
        sessions.map((s, si) => (
          <Card key={si}>
            <h3 className="mb-3 text-base font-semibold">{s.header}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-xs font-semibold uppercase tracking-wide text-stone-400 dark:border-stone-800">
                    <th className="py-2 pr-2"></th>
                    <th className="py-2 pr-2">Class</th>
                    <th className="py-2 pr-2">Entry fee ($)</th>
                    <th className="py-2 pr-2">Added ($)</th>
                    <th className="py-2 pr-2">Date</th>
                    <th className="py-2 pr-2">Arena</th>
                    <th className="py-2 pr-2">Pattern</th>
                    <th className="py-2 pr-2">Youth</th>
                    <th className="py-2">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {s.rows.map((r, ri) => (
                    <tr key={ri} className={r.include ? "" : "opacity-40"}>
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-stone-300 accent-brand-700"
                          checked={r.include}
                          onChange={(e) =>
                            updateRow(si, ri, { include: e.target.checked })
                          }
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          className="min-w-52"
                          value={r.name}
                          onChange={(e) => updateRow(si, ri, { name: e.target.value })}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          className="w-24"
                          value={r.entryFee}
                          onChange={(e) =>
                            updateRow(si, ri, { entryFee: e.target.value })
                          }
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          className="w-24"
                          value={r.addedMoney}
                          onChange={(e) =>
                            updateRow(si, ri, { addedMoney: e.target.value })
                          }
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          type="date"
                          className="w-40"
                          value={r.scheduledDate}
                          onChange={(e) =>
                            updateRow(si, ri, { scheduledDate: e.target.value })
                          }
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          className="w-28"
                          value={r.arena}
                          onChange={(e) => updateRow(si, ri, { arena: e.target.value })}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          className="w-16"
                          value={r.patternNumber}
                          onChange={(e) =>
                            updateRow(si, ri, { patternNumber: e.target.value })
                          }
                        />
                      </td>
                      <td className="py-2 pr-2 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-stone-300 accent-brand-700"
                          checked={r.isYouth}
                          onChange={(e) =>
                            updateRow(si, ri, { isYouth: e.target.checked })
                          }
                        />
                      </td>
                      <td className="py-2">
                        <Input
                          className="min-w-56"
                          value={r.notes}
                          onChange={(e) => updateRow(si, ri, { notes: e.target.value })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}

      {sessions && (
        <div className="flex items-center gap-3">
          <Button disabled={isPending || includedRows.length === 0} onClick={create}>
            {isPending
              ? "Creating…"
              : `Create ${includedRows.length} class${includedRows.length === 1 ? "" : "es"}`}
          </Button>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Class numbers continue from this show&apos;s highest. Pattern group
            numbers print once per block on most bills, so double-check which
            rows they landed on. Parsed values are a starting point — confirm
            against the printed bill before opening entries.
          </p>
        </div>
      )}
    </div>
  );
}
