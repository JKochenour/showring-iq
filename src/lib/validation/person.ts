import { z } from "zod";

export const PERSON_ROLES = [
  { value: "rider", label: "Rider" },
  { value: "owner", label: "Owner" },
  { value: "trainer", label: "Trainer" },
  { value: "agent", label: "Agent" },
  { value: "parent_guardian", label: "Parent / Guardian" },
  { value: "judge", label: "Judge" },
] as const;

export const ASSOCIATIONS = ["NRHA", "AQHA", "APHA", "NSBA", "NRCHA", "EPRHA", "Other"] as const;

export const MEMBERSHIP_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "expired", label: "Expired" },
  { value: "unknown", label: "Unknown" },
] as const;

const roleValues = PERSON_ROLES.map((r) => r.value) as [string, ...string[]];

/** Checkbox groups arrive as string[] (or false when nothing is checked). */
const rolesField = z.preprocess(
  (v) => (v === false || v == null ? [] : typeof v === "string" ? [v] : v),
  z.array(z.enum(roleValues)).min(1, "Pick at least one role")
);

const personFields = {
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  preferredName: z.string().trim().max(80).optional(),
  email: z.email("Enter a valid email address").or(z.literal("")).optional(),
  phone: z.string().trim().max(40).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(40).optional(),
  birthdate: z.iso.date("Enter a valid date").or(z.literal("")).optional(),
  roles: rolesField,
  notes: z.string().trim().max(1000).optional(),
};

export const createPersonSchema = z.object({
  organizationId: z.uuid(),
  ...personFields,
});

export const updatePersonSchema = z.object({
  personId: z.uuid(),
  ...personFields,
});

export const addMembershipSchema = z.object({
  personId: z.uuid(),
  association: z.string().trim().min(2, "Association is required").max(40),
  membershipNumber: z.string().trim().min(1, "Number is required").max(40),
  membershipType: z.string().trim().max(60).optional(),
  status: z.enum(
    MEMBERSHIP_STATUS_OPTIONS.map((s) => s.value) as [string, ...string[]]
  ),
  expirationDate: z.iso.date("Enter a valid date").or(z.literal("")).optional(),
  notes: z.string().trim().max(500).optional(),
});

export type CreatePersonInput = z.infer<typeof createPersonSchema>;
export type CreatePersonFormValues = z.input<typeof createPersonSchema>;
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;
export type UpdatePersonFormValues = z.input<typeof updatePersonSchema>;
export type AddMembershipInput = z.infer<typeof addMembershipSchema>;
