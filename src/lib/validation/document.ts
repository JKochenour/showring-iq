import { z } from "zod";

export const DOCUMENT_TYPES = [
  { value: "membership_card", label: "Membership card" },
  { value: "competition_license", label: "Competition license" },
  { value: "coggins", label: "Coggins" },
  { value: "health_certificate", label: "Health certificate" },
  { value: "non_pro_declaration", label: "Non Pro declaration" },
  { value: "ownership_transfer", label: "Ownership transfer" },
  { value: "show_card", label: "Show card" },
  { value: "other", label: "Other" },
] as const;

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/webp",
]);

export const uploadDocumentSchema = z.object({
  organizationId: z.uuid(),
  personId: z.uuid().or(z.literal("")).optional(),
  horseId: z.uuid().or(z.literal("")).optional(),
  showId: z.uuid().or(z.literal("")).optional(),
  documentType: z.enum(DOCUMENT_TYPES.map((t) => t.value) as [string, ...string[]]),
  expirationDate: z.iso.date("Enter a valid date").or(z.literal("")).optional(),
  notes: z.string().trim().max(500).optional(),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

export function validateFile(file: File): string | null {
  if (file.size === 0) return "File is empty.";
  if (file.size > MAX_FILE_BYTES) return "File is larger than 15MB.";
  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    return "Only PDF, JPEG, PNG, HEIC, or WebP files are accepted.";
  }
  return null;
}

export const rejectDocumentSchema = z.object({
  documentId: z.uuid(),
  rejectionReason: z.string().trim().min(3, "Explain why it's being rejected").max(500),
});
