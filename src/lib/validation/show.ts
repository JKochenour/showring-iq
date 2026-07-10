import { z } from "zod";
import { SLUG_PATTERN } from "@/lib/validation/organization";

export const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern (New York)" },
  { value: "America/Chicago", label: "Central (Chicago)" },
  { value: "America/Denver", label: "Mountain (Denver)" },
  { value: "America/Phoenix", label: "Arizona (Phoenix)" },
  { value: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { value: "America/Anchorage", label: "Alaska (Anchorage)" },
  { value: "Pacific/Honolulu", label: "Hawaii (Honolulu)" },
] as const;

const timezoneValues = US_TIMEZONES.map((t) => t.value) as [string, ...string[]];

export const STAFF_ROLES = [
  { value: "manager", label: "Show Manager" },
  { value: "secretary", label: "Show Secretary" },
  { value: "assistant_secretary", label: "Assistant Secretary" },
  { value: "judge", label: "Judge" },
  { value: "gate", label: "Gate / Paddock" },
  { value: "announcer", label: "Announcer" },
  { value: "treasurer", label: "Treasurer" },
  { value: "score_verifier", label: "Score Verifier" },
  { value: "show_representative", label: "Show Representative" },
  { value: "steward", label: "Steward" },
  { value: "veterinarian", label: "Veterinarian" },
  { value: "farrier", label: "Farrier" },
  { value: "photographer", label: "Photographer" },
  { value: "other", label: "Other" },
] as const;

const staffRoleValues = STAFF_ROLES.map((r) => r.value) as [string, ...string[]];

const showDates = {
  startDate: z.iso.date("Enter a valid date"),
  endDate: z.iso.date("Enter a valid date"),
};

function datesInOrder(data: { startDate: string; endDate: string }) {
  return data.endDate >= data.startDate;
}

export const createShowSchema = z
  .object({
    organizationId: z.uuid(),
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(160),
    slug: z
      .string()
      .trim()
      .min(2, "Slug must be at least 2 characters")
      .max(80)
      .regex(SLUG_PATTERN, "Lowercase letters, numbers, and hyphens only"),
    ...showDates,
    timezone: z.enum(timezoneValues),
    venueName: z.string().trim().max(160).optional(),
    city: z.string().trim().max(80).optional(),
    state: z.string().trim().max(40).optional(),
    contactEmail: z.email("Enter a valid email address").or(z.literal("")).optional(),
  })
  .refine(datesInOrder, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  });

export const updateShowSchema = z
  .object({
    showId: z.uuid(),
    name: z.string().trim().min(2).max(160),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(SLUG_PATTERN, "Lowercase letters, numbers, and hyphens only"),
    ...showDates,
    timezone: z.enum(timezoneValues),
    venueName: z.string().trim().max(160).optional(),
    city: z.string().trim().max(80).optional(),
    state: z.string().trim().max(40).optional(),
    contactName: z.string().trim().max(120).optional(),
    contactEmail: z.email("Enter a valid email address").or(z.literal("")).optional(),
    contactPhone: z.string().trim().max(40).optional(),
    description: z.string().trim().max(2000).optional(),
    nrhaShowNumber: z.string().trim().max(40).optional(),
    medicationFee: z
      .string()
      .trim()
      .regex(/^\d{1,5}(\.\d{1,2})?$/, "Enter a dollar amount like 25 or 25.00")
      .or(z.literal(""))
      .optional(),
  })
  .refine(datesInOrder, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  });

export const addStaffSchema = z
  .object({
    showId: z.uuid(),
    userId: z.uuid().or(z.literal("")).optional(),
    displayName: z.string().trim().max(120).optional(),
    staffRole: z.enum(staffRoleValues, "Choose a role"),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((data) => data.userId || (data.displayName && data.displayName.length > 0), {
    message: "Pick a member or enter a name",
    path: ["displayName"],
  });

export type CreateShowInput = z.infer<typeof createShowSchema>;
export type UpdateShowInput = z.infer<typeof updateShowSchema>;
export type AddStaffInput = z.infer<typeof addStaffSchema>;
