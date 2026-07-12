"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { scoreToTenths } from "@/lib/score";
import {
  correctScoreSchema,
  enterScoreSchema,
  enterJudgeScoreSchema,
  type CorrectScoreInput,
  type EnterScoreInput,
  type EnterJudgeScoreInput,
} from "@/lib/validation/score";

export type ActionResult = { error?: string };

async function classIdForEntryClass(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entryClassId: string
): Promise<{ showId: string; classId: string } | null> {
  const { data } = await supabase
    .from("entry_classes")
    .select("show_id, class_id")
    .eq("id", entryClassId)
    .maybeSingle();
  return data ? { showId: data.show_id, classId: data.class_id } : null;
}

function revalidateScoring(showId: string, classId: string) {
  revalidatePath(`/shows/${showId}/scoring`);
  revalidatePath(`/shows/${showId}/scoring/${classId}`);
}

export async function enterScore(input: EnterScoreInput): Promise<ActionResult> {
  const parsed = enterScoreSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const location = await classIdForEntryClass(supabase, d.entryClassId);
  if (!location) return { error: "Entry not found." };

  const { error } = await supabase.rpc("enter_score", {
    p_entry_class: d.entryClassId,
    p_result_status: d.resultStatus,
    p_total_score_tenths: scoreToTenths(d.totalScore ?? ""),
    p_judge_staff_id: d.judgeStaffId || null,
    p_penalty_points_tenths: scoreToTenths(d.penaltyPoints ?? "") ?? 0,
    p_notes: d.notes || null,
  });
  if (error) return { error: error.message };

  revalidateScoring(location.showId, location.classId);
  return {};
}

export async function enterJudgeScore(
  input: EnterJudgeScoreInput
): Promise<ActionResult> {
  const parsed = enterJudgeScoreSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const location = await classIdForEntryClass(supabase, d.entryClassId);
  if (!location) return { error: "Entry not found." };

  const { error } = await supabase.rpc("enter_judge_score", {
    p_entry_class: d.entryClassId,
    p_judge_staff_id: d.judgeStaffId,
    p_total_score_tenths: scoreToTenths(d.totalScore) ?? null,
    p_penalty_points_tenths: scoreToTenths(d.penaltyPoints ?? "") ?? 0,
    p_notes: d.notes || null,
  });
  if (error) return { error: error.message };

  revalidateScoring(location.showId, location.classId);
  return {};
}

export async function submitScore(
  entryClassId: string,
  signatureName: string
): Promise<ActionResult> {
  if (!signatureName.trim()) {
    return { error: "A signature (typed name) is required to submit a score card." };
  }
  const supabase = await createClient();
  const location = await classIdForEntryClass(supabase, entryClassId);
  if (!location) return { error: "Entry not found." };

  const { error } = await supabase.rpc("submit_score", {
    p_entry_class: entryClassId,
    p_signature_name: signatureName.trim(),
  });
  if (error) return { error: error.message };

  revalidateScoring(location.showId, location.classId);
  return {};
}

export async function verifyScore(entryClassId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const location = await classIdForEntryClass(supabase, entryClassId);
  if (!location) return { error: "Entry not found." };

  const { error } = await supabase.rpc("verify_score", {
    p_entry_class: entryClassId,
  });
  if (error) return { error: error.message };

  revalidateScoring(location.showId, location.classId);
  return {};
}

export async function reopenScore(
  entryClassId: string,
  reason: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const location = await classIdForEntryClass(supabase, entryClassId);
  if (!location) return { error: "Entry not found." };

  const { error } = await supabase.rpc("reopen_score", {
    p_entry_class: entryClassId,
    p_reason: reason,
  });
  if (error) return { error: error.message };

  revalidateScoring(location.showId, location.classId);
  return {};
}

export async function correctScore(
  input: CorrectScoreInput
): Promise<ActionResult> {
  const parsed = correctScoreSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const location = await classIdForEntryClass(supabase, d.entryClassId);
  if (!location) return { error: "Entry not found." };

  const { error } = await supabase.rpc("correct_score", {
    p_entry_class: d.entryClassId,
    p_correction_type: d.correctionType,
    p_result_status: d.resultStatus,
    p_total_score_tenths: scoreToTenths(d.totalScore ?? ""),
    p_penalty_points_tenths: scoreToTenths(d.penaltyPoints ?? "") ?? 0,
    p_notes: d.notes || null,
    p_reason: d.reason,
  });
  if (error) return { error: error.message };

  revalidateScoring(location.showId, location.classId);
  return {};
}

export async function markClassScoringComplete(
  classId: string,
  showId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_class_scoring_complete", {
    p_class: classId,
  });
  if (error) return { error: error.message };

  revalidateScoring(showId, classId);
  revalidatePath(`/shows/${showId}/classes`);
  return {};
}

export async function markClassOfficial(
  classId: string,
  showId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_class_official", {
    p_class: classId,
  });
  if (error) return { error: error.message };

  revalidateScoring(showId, classId);
  revalidatePath(`/shows/${showId}/classes`);
  revalidatePath(`/shows/${showId}/results`);
  return {};
}
