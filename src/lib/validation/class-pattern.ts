import { z } from "zod";

export const setClassPatternSchema = z
  .object({
    classId: z.uuid(),
    patternText: z.string().trim().max(4000).optional(),
    documentId: z.uuid().or(z.literal("")).optional(),
  })
  .refine((d) => !!d.patternText?.trim() || !!d.documentId, {
    message: "Enter pattern text or attach a document",
    path: ["patternText"],
  });

export type SetClassPatternInput = z.infer<typeof setClassPatternSchema>;
