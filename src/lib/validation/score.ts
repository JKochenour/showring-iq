import { z } from "zod";
import { SCORE_PATTERN } from "@/lib/score";

export const RESULT_STATUS_OPTIONS = [
  { value: "shown", label: "Shown (scored)" },
  { value: "zero", label: "Zero score" },
  { value: "no_score", label: "No score" },
  { value: "dq", label: "Disqualified" },
  { value: "excused", label: "Excused" },
] as const;

const resultStatusValues = RESULT_STATUS_OPTIONS.map((s) => s.value) as [
  string,
  ...string[],
];

const scoreValue = z
  .string()
  .trim()
  .regex(SCORE_PATTERN, "Enter a score like 70 or 70.5")
  .or(z.literal(""))
  .optional();

const baseScoreFields = z.object({
  entryClassId: z.uuid(),
  judgeStaffId: z.uuid().or(z.literal("")).optional(),
  resultStatus: z.enum(resultStatusValues),
  totalScore: scoreValue,
  penaltyPoints: scoreValue,
  notes: z.string().trim().max(500).optional(),
});

function requireScoreWhenShown(data: { resultStatus: string; totalScore?: string }) {
  return data.resultStatus !== "shown" || !!data.totalScore?.trim();
}

export const enterScoreSchema = baseScoreFields.refine(requireScoreWhenShown, {
  message: "Enter the total score",
  path: ["totalScore"],
});

export const CORRECTION_TYPES = [
  { value: "judge_sheet_correction", label: "Judge sheet correction" },
  { value: "data_entry_correction", label: "Data entry correction" },
] as const;

export const correctScoreSchema = baseScoreFields
  .extend({
    correctionType: z.enum(
      CORRECTION_TYPES.map((c) => c.value) as [string, ...string[]]
    ),
    reason: z.string().trim().min(3, "Reason is required").max(500),
  })
  .refine(requireScoreWhenShown, {
    message: "Enter the total score",
    path: ["totalScore"],
  });

export type EnterScoreInput = z.infer<typeof enterScoreSchema>;
export type CorrectScoreInput = z.infer<typeof correctScoreSchema>;

/** One judge's independent call on a multi-judge run — see
 * enter_judge_score / score_judges (migration 00037). */
export const enterJudgeScoreSchema = z.object({
  entryClassId: z.uuid(),
  judgeStaffId: z.uuid(),
  totalScore: z.string().trim().regex(SCORE_PATTERN, "Enter a score like 70 or 70.5"),
  penaltyPoints: scoreValue,
  notes: z.string().trim().max(500).optional(),
});

export type EnterJudgeScoreInput = z.infer<typeof enterJudgeScoreSchema>;
