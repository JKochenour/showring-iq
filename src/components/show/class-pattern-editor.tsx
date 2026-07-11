"use client";

import { useState, useTransition } from "react";
import {
  deleteClassPattern,
  setClassPattern,
} from "@/app/(app)/shows/[id]/classes/actions";
import { getDocumentSignedUrl } from "@/app/(app)/organizations/[id]/documents/actions";
import { Button, Card, Label, Select, Textarea } from "@/components/ui";
import { useConfirmDialog } from "@/components/confirm-dialog";
import type { ClassPatternRow } from "@/lib/types";

export interface DocumentOption {
  id: string;
  label: string;
}

/** Office-only editor for a class's pattern (numbered steps as text,
 * plus an optional link to an already-uploaded document such as a
 * scanned official pattern sheet). Judges see this read-only on the
 * scoring screen — see ClassPatternView below. */
export function ClassPatternEditor({
  classId,
  pattern,
  documentOptions,
  editable,
}: {
  classId: string;
  pattern: ClassPatternRow | null;
  documentOptions: DocumentOption[];
  editable: boolean;
}) {
  const [editing, setEditing] = useState(!pattern);
  const [patternText, setPatternText] = useState(pattern?.pattern_text ?? "");
  const [documentId, setDocumentId] = useState(pattern?.document_id ?? "");
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const confirm = useConfirmDialog();

  const save = () => {
    setError(undefined);
    startTransition(async () => {
      const result = await setClassPattern({ classId, patternText, documentId });
      if (result?.error) setError(result.error);
      else setEditing(false);
    });
  };

  const remove = async () => {
    const result = await confirm({
      title: "Remove pattern",
      message: "Remove this pattern?",
      tone: "danger",
      confirmLabel: "Remove",
    });
    if (!result) return;
    setError(undefined);
    startTransition(async () => {
      const result = await deleteClassPattern(classId);
      if (result?.error) setError(result.error);
      else {
        setPatternText("");
        setDocumentId("");
        setEditing(true);
      }
    });
  };

  if (!editable && !pattern) return null;

  return (
    <Card>
      <h3 className="mb-1 text-base font-semibold">Pattern</h3>
      {!editable ? (
        <PatternDisplay pattern={pattern} documentOptions={documentOptions} />
      ) : editing ? (
        <div className="space-y-3">
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
          <div>
            <Label htmlFor="patternText">Pattern (numbered steps)</Label>
            <Textarea
              id="patternText"
              rows={6}
              placeholder={"1. Run to center, stop.\n2. Left spin 4 times.\n…"}
              value={patternText}
              onChange={(e) => setPatternText(e.target.value)}
            />
          </div>
          {documentOptions.length > 0 && (
            <div>
              <Label htmlFor="patternDocument">
                Or attach an uploaded document (optional)
              </Label>
              <Select
                id="patternDocument"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
              >
                <option value="">None</option>
                {documentOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="flex gap-2">
            <Button disabled={isPending} onClick={save}>
              {isPending ? "Saving…" : "Save pattern"}
            </Button>
            {pattern && (
              <Button
                variant="secondary"
                disabled={isPending}
                onClick={() => {
                  setPatternText(pattern.pattern_text ?? "");
                  setDocumentId(pattern.document_id ?? "");
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <PatternDisplay pattern={pattern} documentOptions={documentOptions} />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit pattern
            </Button>
            <Button variant="danger" disabled={isPending} onClick={remove}>
              Remove
            </Button>
          </div>
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
      )}
    </Card>
  );
}

function PatternDisplay({
  pattern,
  documentOptions,
}: {
  pattern: ClassPatternRow | null;
  documentOptions: DocumentOption[];
}) {
  if (!pattern) {
    return (
      <p className="text-sm text-stone-500 dark:text-stone-400">
        No pattern set for this class yet.
      </p>
    );
  }
  const docLabel = pattern.document_id
    ? documentOptions.find((d) => d.id === pattern.document_id)?.label
    : null;
  return (
    <div className="space-y-2 text-sm">
      {pattern.pattern_text && (
        <p className="whitespace-pre-wrap">{pattern.pattern_text}</p>
      )}
      {pattern.document_id && (
        <p className="text-stone-500 dark:text-stone-400">
          Attached document:{" "}
          {docLabel ?? "—"} <ViewDocumentLink documentId={pattern.document_id} />
        </p>
      )}
    </div>
  );
}

function ViewDocumentLink({ documentId }: { documentId: string }) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  return (
    <>
      <button
        type="button"
        className="text-brand-700 hover:underline disabled:opacity-50 dark:text-brand-500"
        disabled={isPending}
        onClick={() => {
          setError(undefined);
          startTransition(async () => {
            const result = await getDocumentSignedUrl(documentId);
            if (result.error) setError(result.error);
            else if (result.url) window.open(result.url, "_blank", "noopener,noreferrer");
          });
        }}
      >
        {isPending ? "Loading…" : "View"}
      </button>
      {error && (
        <span className="ml-2 text-red-600 dark:text-red-400">{error}</span>
      )}
    </>
  );
}

/** Read-only pattern card for the scoring screen — visible to both
 * the assigned judge and office staff viewing a class's scoring page. */
export function ClassPatternCard({
  pattern,
  documentOptions,
}: {
  pattern: ClassPatternRow | null;
  documentOptions: DocumentOption[];
}) {
  if (!pattern) return null;
  return (
    <Card>
      <h3 className="mb-2 text-base font-semibold">Pattern</h3>
      <PatternDisplay pattern={pattern} documentOptions={documentOptions} />
    </Card>
  );
}
