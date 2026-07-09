import { z } from "zod";

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  slug: z
    .string()
    .trim()
    .min(2, "Slug must be at least 2 characters")
    .max(60)
    .regex(SLUG_PATTERN, "Lowercase letters, numbers, and hyphens only (e.g. eprha)"),
  contactEmail: z.email("Enter a valid email address").or(z.literal("")).optional(),
});

export const updateOrganizationSchema = z.object({
  organizationId: z.uuid(),
  name: z.string().trim().min(2).max(120),
  contactEmail: z.email("Enter a valid email address").or(z.literal("")).optional(),
  website: z.url("Enter a valid URL").or(z.literal("")).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(40).optional(),
});

export const inviteMemberSchema = z.object({
  organizationId: z.uuid(),
  email: z.email("Enter a valid email address"),
  roleId: z.uuid("Choose a role"),
});

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
