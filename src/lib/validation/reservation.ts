import { z } from "zod";
import { MONEY_PATTERN } from "@/lib/money";

/** Show-configured reservation catalog (stall, camper, a slotted
 * warm-up, etc.) — reservation_types on shows, same shape/UI pattern
 * as standard_entry_charges. */
export const reservationTypeRowSchema = z.object({
  key: z.string().trim().min(1, "Key is required").max(40),
  label: z.string().trim().min(1, "Label is required").max(80),
  unitPrice: z
    .string()
    .trim()
    .regex(MONEY_PATTERN, "Enter a dollar amount like 25 or 25.00")
    .or(z.literal("")),
  /** Comma-separated slot choices, e.g. "Wed AM, Wed PM". Empty = a
   * plain quantity item with no slot to choose. */
  slotOptionsText: z.string().trim().max(400).optional(),
});

export const updateReservationTypesSchema = z.object({
  showId: z.uuid(),
  types: z.array(reservationTypeRowSchema).max(20),
});

export type ReservationTypeRow = z.infer<typeof reservationTypeRowSchema>;
export type UpdateReservationTypesInput = z.infer<typeof updateReservationTypesSchema>;

export const requestReservationSchema = z.object({
  showId: z.uuid(),
  personId: z.uuid("Choose a person"),
  typeKey: z.string().trim().min(1, "Choose a reservation type"),
  quantity: z.coerce.number().int().min(1).max(100),
  slotLabel: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(500).optional(),
});

export type RequestReservationInput = z.infer<typeof requestReservationSchema>;
