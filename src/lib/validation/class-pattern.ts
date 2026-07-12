import { z } from "zod";

export const NRHA_PATTERN_KEYS = [
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "A", "B",
] as const;

export const setClassPatternSchema = z
  .object({
    classId: z.uuid(),
    patternText: z.string().trim().max(4000).optional(),
    patternKey: z.enum(NRHA_PATTERN_KEYS).or(z.literal("")).optional(),
    documentId: z.uuid().or(z.literal("")).optional(),
  })
  .refine((d) => !!d.patternText?.trim() || !!d.documentId, {
    message: "Enter pattern text or attach a document",
    path: ["patternText"],
  });

export type SetClassPatternInput = z.infer<typeof setClassPatternSchema>;
