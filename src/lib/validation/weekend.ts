import { z } from "zod";

/** Group one or more existing (entry-free) shows into a new weekend. */
export const groupShowsSchema = z.object({
  organizationId: z.uuid(),
  name: z.string().trim().min(1, "Name the weekend").max(160),
  showIds: z.array(z.uuid()).min(1, "Select at least one show"),
});
export type GroupShowsInput = z.infer<typeof groupShowsSchema>;

export const renameWeekendSchema = z.object({
  weekendId: z.uuid(),
  organizationId: z.uuid(),
  name: z.string().trim().min(1, "Name the weekend").max(160),
});
export type RenameWeekendInput = z.infer<typeof renameWeekendSchema>;

export const addShowToWeekendSchema = z.object({
  weekendId: z.uuid(),
  organizationId: z.uuid(),
  showId: z.uuid(),
});
export type AddShowToWeekendInput = z.infer<typeof addShowToWeekendSchema>;

/** One weekend sign-up: a horse + rider entered across one or more slates,
 * with which classes in each. Same horse under a different rider is a
 * separate sign-up (they share the horse's weekend back number). */
export const createWeekendEntrySchema = z
  .object({
    weekendId: z.uuid(),
    horseId: z.uuid(),
    riderPersonId: z.uuid(),
    billTo: z.enum(["rider", "owner"]),
    ownerPersonId: z.uuid().or(z.literal("")).optional(),
    /** Party to receive winning checks; empty = default (owner → rider). */
    payeePersonId: z.uuid().or(z.literal("")).optional(),
    slates: z
      .array(
        z.object({
          showId: z.uuid(),
          classIds: z.array(z.uuid()),
        })
      )
      .min(1),
  })
  .refine((d) => d.slates.some((s) => s.classIds.length > 0), {
    message: "Pick at least one class in one slate.",
    path: ["slates"],
  })
  .refine((d) => d.billTo !== "owner" || (!!d.ownerPersonId && d.ownerPersonId !== ""), {
    message: "Choose the owner to bill.",
    path: ["ownerPersonId"],
  });
export type CreateWeekendEntryInput = z.infer<typeof createWeekendEntrySchema>;
export type CreateWeekendEntryFormValues = z.input<typeof createWeekendEntrySchema>;
