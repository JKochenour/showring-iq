"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import {
  rejectDocumentSchema,
  uploadDocumentSchema,
  validateFile,
} from "@/lib/validation/document";

export type ActionResult = { error?: string };

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180);
  return cleaned || "document";
}

export async function uploadDocument(formData: FormData): Promise<ActionResult> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const personId = String(formData.get("personId") ?? "");
  const horseId = String(formData.get("horseId") ?? "");
  const showId = String(formData.get("showId") ?? "");
  const documentType = String(formData.get("documentType") ?? "");
  const expirationDate = String(formData.get("expirationDate") ?? "");
  const notes = String(formData.get("notes") ?? "");
  const file = formData.get("file");

  const parsed = uploadDocumentSchema.safeParse({
    organizationId,
    personId,
    horseId,
    showId,
    documentType,
    expirationDate,
    notes,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  if (!(d.personId || d.horseId || d.showId)) {
    return { error: "Document must be attached to a person, horse, or show." };
  }
  if (!(file instanceof File)) {
    return { error: "No file was uploaded." };
  }
  const fileError = validateFile(file);
  if (fileError) return { error: fileError };

  const { supabase, user } = await requireUser();

  if (!(await hasOrgPermission(organizationId, "document.upload"))) {
    return { error: "You don't have permission to upload documents in this organization." };
  }

  const path = `${organizationId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage.from("documents").upload(path, file, {
    contentType: file.type || "application/octet-stream",
  });
  if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

  const { data: created, error } = await supabase
    .from("documents")
    .insert({
      organization_id: organizationId,
      person_id: d.personId || null,
      horse_id: d.horseId || null,
      show_id: d.showId || null,
      document_type: d.documentType,
      file_path: path,
      file_name: file.name,
      file_size_bytes: file.size,
      mime_type: file.type || null,
      expiration_date: d.expirationDate || null,
      notes: d.notes || null,
      uploaded_by: user.id,
    })
    .select("id")
    .maybeSingle();

  if (error || !created) {
    await supabase.storage.from("documents").remove([path]);
    return { error: error?.message ?? "Document row was not created." };
  }

  await supabase.rpc("log_audit", {
    p_org: organizationId,
    p_action: "document.uploaded",
    p_entity_type: "document",
    p_entity_id: created.id,
    p_old: null,
    p_new: { document_type: d.documentType, file_name: file.name },
    p_show: d.showId || null,
  });

  revalidatePath(`/organizations/${organizationId}`, "layout");
  return {};
}

async function loadDocForAudit(supabase: Awaited<ReturnType<typeof createClient>>, documentId: string) {
  return supabase
    .from("documents")
    .select("organization_id, document_type, file_name, status, show_id")
    .eq("id", documentId)
    .maybeSingle();
}

export async function verifyDocument(documentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: doc } = await loadDocForAudit(supabase, documentId);
  if (!doc) return { error: "Document not found." };

  const { data: updated, error } = await supabase
    .from("documents")
    .update({ status: "verified", verified_at: new Date().toISOString(), rejection_reason: null })
    .eq("id", documentId)
    .select("id");

  if (error) return { error: error.message };
  if (!updated || updated.length === 0) {
    return { error: "Not verified. You may lack the document.verify permission." };
  }

  await supabase.rpc("log_audit", {
    p_org: doc.organization_id,
    p_action: "document.verified",
    p_entity_type: "document",
    p_entity_id: documentId,
    p_old: { status: doc.status },
    p_new: { status: "verified" },
    p_show: doc.show_id,
  });

  revalidatePath(`/organizations/${doc.organization_id}`, "layout");
  return {};
}

export async function rejectDocument(input: {
  documentId: string;
  rejectionReason: string;
}): Promise<ActionResult> {
  const parsed = rejectDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { data: doc } = await loadDocForAudit(supabase, d.documentId);
  if (!doc) return { error: "Document not found." };

  const { data: updated, error } = await supabase
    .from("documents")
    .update({ status: "rejected", rejection_reason: d.rejectionReason, verified_at: null })
    .eq("id", d.documentId)
    .select("id");

  if (error) return { error: error.message };
  if (!updated || updated.length === 0) {
    return { error: "Not rejected. You may lack the document.reject permission." };
  }

  await supabase.rpc("log_audit", {
    p_org: doc.organization_id,
    p_action: "document.rejected",
    p_entity_type: "document",
    p_entity_id: d.documentId,
    p_old: { status: doc.status },
    p_new: { status: "rejected", reason: d.rejectionReason },
    p_show: doc.show_id,
  });

  revalidatePath(`/organizations/${doc.organization_id}`, "layout");
  return {};
}

export async function deleteDocument(documentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("organization_id, file_path, document_type, file_name, show_id")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return { error: "Document not found." };

  const { data: deleted, error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
    .select("id");

  if (error) return { error: error.message };
  if (!deleted || deleted.length === 0) {
    return { error: "Not deleted. You may lack the document.delete permission." };
  }

  await supabase.storage.from("documents").remove([doc.file_path]);

  await supabase.rpc("log_audit", {
    p_org: doc.organization_id,
    p_action: "document.deleted",
    p_entity_type: "document",
    p_entity_id: documentId,
    p_old: { document_type: doc.document_type, file_name: doc.file_name },
    p_new: null,
    p_show: doc.show_id,
  });

  revalidatePath(`/organizations/${doc.organization_id}`, "layout");
  return {};
}

export async function getDocumentSignedUrl(
  documentId: string
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("file_path")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return { error: "Document not found." };

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.file_path, 300);
  if (error || !data) return { error: error?.message ?? "Could not create a signed URL." };

  return { url: data.signedUrl };
}
