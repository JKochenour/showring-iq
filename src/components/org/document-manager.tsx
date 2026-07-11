"use client";

import { useRef, useState, useTransition } from "react";
import {
  deleteDocument,
  getDocumentSignedUrl,
  rejectDocument,
  uploadDocument,
  verifyDocument,
} from "@/app/(app)/organizations/[id]/documents/actions";
import { DOCUMENT_TYPES } from "@/lib/validation/document";
import { Alert, Button, Input, Label, Select } from "@/components/ui";
import { useConfirmDialog } from "@/components/confirm-dialog";
import type { DocumentRow } from "@/lib/types";

function formatBytes(n: number | null): string {
  if (!n) return "";
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  verified: "bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

function typeLabel(value: string): string {
  return DOCUMENT_TYPES.find((t) => t.value === value)?.label ?? value;
}

function expirationTone(dateStr: string | null): { label: string; className: string } | null {
  if (!dateStr) return null;
  const days = Math.floor((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: `Expired ${dateStr}`, className: "text-red-600 dark:text-red-400" };
  if (days <= 60) return { label: `Expires ${dateStr}`, className: "text-amber-600 dark:text-amber-400" };
  return { label: `Expires ${dateStr}`, className: "text-stone-500 dark:text-stone-400" };
}

function ViewButton({ documentId }: { documentId: string }) {
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
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </>
  );
}

function RejectControl({ documentId }: { documentId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        className="text-red-600 hover:underline dark:text-red-400"
        onClick={() => setOpen(true)}
      >
        Reject
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        <Input
          className="h-7 w-40 text-xs"
          placeholder="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <Button
          type="button"
          variant="danger"
          className="px-2 py-1 text-xs"
          disabled={isPending}
          onClick={() => {
            setError(undefined);
            startTransition(async () => {
              const result = await rejectDocument({ documentId, rejectionReason: reason });
              if (result?.error) setError(result.error);
              else setOpen(false);
            });
          }}
        >
          {isPending ? "…" : "Confirm"}
        </Button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

export function DocumentManager({
  organizationId,
  personId,
  horseId,
  showId,
  documents,
  canUpload,
  canVerify,
  canReject,
  canDelete,
}: {
  organizationId: string;
  personId?: string;
  horseId?: string;
  showId?: string;
  documents: DocumentRow[];
  canUpload: boolean;
  canVerify: boolean;
  canReject: boolean;
  canDelete: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [uploadError, setUploadError] = useState<string>();
  const [isUploading, startUpload] = useTransition();
  const [rowError, setRowError] = useState<string>();
  const [isRowPending, startRowTransition] = useTransition();
  const confirm = useConfirmDialog();

  function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadError(undefined);
    const formData = new FormData(e.currentTarget);
    startUpload(async () => {
      const result = await uploadDocument(formData);
      if (result?.error) setUploadError(result.error);
      else formRef.current?.reset();
    });
  }

  return (
    <div>
      {documents.length > 0 && (
        <ul className="mb-4 divide-y divide-stone-200 dark:divide-stone-800">
          {documents.map((doc) => {
            const exp = expirationTone(doc.expiration_date);
            return (
              <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {typeLabel(doc.document_type)}{" "}
                    <span
                      className={`ml-1 inline-block rounded px-1.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[doc.status]}`}
                    >
                      {doc.status}
                    </span>
                  </p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {doc.file_name} {doc.file_size_bytes ? `· ${formatBytes(doc.file_size_bytes)}` : ""}
                  </p>
                  {exp && <p className={`text-xs ${exp.className}`}>{exp.label}</p>}
                  {doc.status === "rejected" && doc.rejection_reason && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      Reason: {doc.rejection_reason}
                    </p>
                  )}
                  {doc.notes && (
                    <p className="text-xs text-stone-500 dark:text-stone-400">{doc.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <ViewButton documentId={doc.id} />
                  {canVerify && doc.status !== "verified" && (
                    <button
                      type="button"
                      className="text-brand-700 hover:underline disabled:opacity-50 dark:text-brand-500"
                      disabled={isRowPending}
                      onClick={() => {
                        setRowError(undefined);
                        startRowTransition(async () => {
                          const result = await verifyDocument(doc.id);
                          if (result?.error) setRowError(result.error);
                        });
                      }}
                    >
                      Verify
                    </button>
                  )}
                  {canReject && doc.status !== "rejected" && <RejectControl documentId={doc.id} />}
                  {canDelete && (
                    <button
                      type="button"
                      className="text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                      disabled={isRowPending}
                      onClick={async () => {
                        const result = await confirm({
                          title: "Delete document",
                          message: `Delete ${doc.file_name}? This cannot be undone.`,
                          tone: "danger",
                          confirmLabel: "Delete",
                        });
                        if (!result) return;
                        setRowError(undefined);
                        startRowTransition(async () => {
                          const result = await deleteDocument(doc.id);
                          if (result?.error) setRowError(result.error);
                        });
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {rowError && (
        <div className="mb-3">
          <Alert>{rowError}</Alert>
        </div>
      )}
      {documents.length === 0 && (
        <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">No documents uploaded yet.</p>
      )}

      {canUpload && (
        <form ref={formRef} onSubmit={handleUpload} className="space-y-3">
          {uploadError && <Alert>{uploadError}</Alert>}
          <input type="hidden" name="organizationId" value={organizationId} />
          {personId && <input type="hidden" name="personId" value={personId} />}
          {horseId && <input type="hidden" name="horseId" value={horseId} />}
          {showId && <input type="hidden" name="showId" value={showId} />}
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <Label htmlFor="documentType">Type</Label>
              <Select id="documentType" name="documentType" defaultValue="other">
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="expirationDate">Expires (optional)</Label>
              <Input id="expirationDate" name="expirationDate" type="date" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input id="notes" name="notes" />
            </div>
          </div>
          <div>
            <Label htmlFor="file">File (PDF, JPEG, PNG, HEIC, WebP — up to 15MB)</Label>
            <input
              id="file"
              name="file"
              type="file"
              required
              accept=".pdf,.jpg,.jpeg,.png,.heic,.webp,application/pdf,image/*"
              className="block w-full text-sm text-stone-700 file:mr-4 file:rounded-md file:border-0 file:bg-brand-700 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-800 dark:text-stone-300"
            />
          </div>
          <Button type="submit" variant="secondary" disabled={isUploading}>
            {isUploading ? "Uploading…" : "Upload document"}
          </Button>
        </form>
      )}
    </div>
  );
}
