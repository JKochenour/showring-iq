import { z } from "zod";
import { MEMBERSHIP_STATUS_OPTIONS } from "@/lib/validation/person";

export const HORSE_SEXES = [
  { value: "mare", label: "Mare" },
  { value: "gelding", label: "Gelding" },
  { value: "stallion", label: "Stallion" },
] as const;

const optionalYear = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce
    .number()
    .int("Whole years only")
    .min(1980, "Enter a 4-digit year")
    .max(2100, "Enter a 4-digit year")
    .optional()
);

const horseFields = {
  registeredName: z
    .string()
    .trim()
    .min(2, "Registered name is required")
    .max(120),
  barnName: z.string().trim().max(80).optional(),
  breed: z.string().trim().max(80).optional(),
  sex: z
    .enum(HORSE_SEXES.map((s) => s.value) as [string, ...string[]])
    .or(z.literal(""))
    .optional(),
  color: z.string().trim().max(60).optional(),
  foalYear: optionalYear,
  sire: z.string().trim().max(120).optional(),
  dam: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
};

export const createHorseSchema = z.object({
  organizationId: z.uuid(),
  ...horseFields,
});

export const updateHorseSchema = z.object({
  horseId: z.uuid(),
  ...horseFields,
});

export const addRegistrationSchema = z
  .object({
    horseId: z.uuid(),
    association: z.string().trim().min(2, "Association is required").max(40),
    registrationNumber: z.string().trim().max(40).optional(),
    competitionLicenseNumber: z.string().trim().max(40).optional(),
    status: z.enum(
      MEMBERSHIP_STATUS_OPTIONS.map((s) => s.value) as [string, ...string[]]
    ),
    expirationDate: z.iso.date("Enter a valid date").or(z.literal("")).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((d) => d.registrationNumber || d.competitionLicenseNumber, {
    message: "Enter a registration number or a competition license number",
    path: ["registrationNumber"],
  });

export const addOwnershipSchema = z.object({
  horseId: z.uuid(),
  ownerPersonId: z.uuid("Choose an owner"),
  percentage: z.coerce
    .number("Enter a percentage")
    .int("Whole numbers only")
    .min(1)
    .max(100),
  startDate: z.iso.date("Enter a valid date").or(z.literal("")).optional(),
  notes: z.string().trim().max(500).optional(),
});

export type CreateHorseInput = z.infer<typeof createHorseSchema>;
export type CreateHorseFormValues = z.input<typeof createHorseSchema>;
export type UpdateHorseInput = z.infer<typeof updateHorseSchema>;
export type UpdateHorseFormValues = z.input<typeof updateHorseSchema>;
export type AddRegistrationInput = z.infer<typeof addRegistrationSchema>;
export type AddOwnershipInput = z.infer<typeof addOwnershipSchema>;
export type AddOwnershipFormValues = z.input<typeof addOwnershipSchema>;

const ownHorseFields = {
  barnName: z.string().trim().max(80).optional(),
  breed: z.string().trim().max(80).optional(),
  sex: z
    .enum(HORSE_SEXES.map((s) => s.value) as [string, ...string[]])
    .or(z.literal(""))
    .optional(),
  color: z.string().trim().max(60).optional(),
  foalYear: optionalYear,
  sire: z.string().trim().max(120).optional(),
  dam: z.string().trim().max(120).optional(),
};

export const createOwnHorseSchema = z.object({
  organizationId: z.uuid(),
  registeredName: z.string().trim().min(2, "Registered name is required").max(120),
  ...ownHorseFields,
});

export const updateOwnHorseSchema = z.object({
  horseId: z.uuid(),
  organizationId: z.uuid(),
  ...ownHorseFields,
});

export type CreateOwnHorseInput = z.infer<typeof createOwnHorseSchema>;
export type CreateOwnHorseFormValues = z.input<typeof createOwnHorseSchema>;
export type UpdateOwnHorseInput = z.infer<typeof updateOwnHorseSchema>;
export type UpdateOwnHorseFormValues = z.input<typeof updateOwnHorseSchema>;
