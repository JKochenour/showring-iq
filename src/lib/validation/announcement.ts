import { z } from "zod";

export const sendAnnouncementSchema = z.object({
  showId: z.uuid(),
  subject: z.string().trim().min(2, "Subject is required").max(120),
  body: z.string().trim().min(2, "Message is required").max(2000),
  sendEmail: z.boolean().default(true),
  sendSms: z.boolean().default(true),
});

export type SendAnnouncementInput = z.infer<typeof sendAnnouncementSchema>;
